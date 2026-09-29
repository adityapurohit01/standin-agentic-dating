import { getSqlite } from "../db";
import { ApifyConnector, downloadMediaImages } from "../connectors/apify";
import { normalizeLinkedIn, normalizeInstagram, cleanUrl } from "../connectors/normalize";
import { checkIdentityMatch } from "../connectors/identity";
import { extractFacts } from "../reader/facts";
import { generatePersona } from "../reader/persona";
import { calculateVoiceMetrics } from "../voice/metrics";
import { extractExemplars, generateStyleNotes } from "../voice/profile";
import { evaluateVoiceFidelity } from "../voice/fidelity";
import { initializeSemanticMemory } from "../memory/store";
import { runReflection } from "../memory/reflect";
import { executeDate } from "../dating/run-date";
import { calculateAllRankings } from "../ranking/rank";
import { emitEvent } from "../events";
import crypto from "crypto";
import pLimit from "p-limit";

export async function handleCollect(personId: string): Promise<void> {
  const sqlite = getSqlite();
  const person = sqlite.prepare("SELECT * FROM people WHERE id = ?").get(personId) as any;
  if (!person) return;

  sqlite.prepare("UPDATE people SET status = 'collecting', updated_at = ? WHERE id = ?").run(Date.now(), personId);
  emitEvent("pipeline:status", { stage: "collecting", personId, name: person.name });

  const connector = new ApifyConnector();
  const liUrls = [person.linkedin_url];
  const igHandles = [person.instagram_url];

  const [liResults, igResults] = await Promise.all([
    connector.fetchLinkedIn(liUrls),
    connector.fetchInstagram(igHandles),
  ]);

  const liData = liResults[0]?.data || {};
  const igData = igResults[0]?.data || {};

  // Store raw sources
  sqlite.prepare(`
    INSERT INTO raw_sources (id, person_id, source, raw_json, fetched_at)
    VALUES (?, ?, 'linkedin', ?, ?)
  `).run(crypto.randomUUID(), personId, JSON.stringify(liData), Date.now());

  sqlite.prepare(`
    INSERT INTO raw_sources (id, person_id, source, raw_json, fetched_at)
    VALUES (?, ?, 'instagram', ?, ?)
  `).run(crypto.randomUUID(), personId, JSON.stringify(igData), Date.now());

  // Normalize
  const normLi = normalizeLinkedIn(liData);
  const normIg = normalizeInstagram(igData);

  // Identity check
  const idCheck = checkIdentityMatch(normLi, normIg, person.linkedin_url);

  // Download images if present
  const downloadedMedia = await downloadMediaImages(personId, normIg.posts || []);
  for (const m of downloadedMedia) {
    sqlite.prepare(`
      INSERT INTO media (id, person_id, original_url, local_path, caption, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), personId, m.originalUrl, m.localPath, m.caption, Date.now());
  }

  const name = normLi.name || normIg.name || person.name || "Candidate";
  const headline = normLi.headline || normLi.currentRole || person.headline || "";

  sqlite.prepare(`
    UPDATE people
    SET name = ?, headline = ?, status = 'reading', identity_match = ?, identity_notes = ?, updated_at = ?
    WHERE id = ?
  `).run(name, headline, idCheck.matchScore, idCheck.notes, Date.now(), personId);

  emitEvent("pipeline:status", { stage: "collected", personId, name });
}

export async function handleRead(personId: string): Promise<void> {
  const sqlite = getSqlite();
  const person = sqlite.prepare("SELECT * FROM people WHERE id = ?").get(personId) as any;
  if (!person) return;

  const rawLiRow = sqlite.prepare("SELECT raw_json FROM raw_sources WHERE person_id = ? AND source = 'linkedin'").get(personId) as any;
  const rawIgRow = sqlite.prepare("SELECT raw_json FROM raw_sources WHERE person_id = ? AND source = 'instagram'").get(personId) as any;
  const mediaRows = sqlite.prepare("SELECT local_path, original_url, caption FROM media WHERE person_id = ?").all(personId) as any[];

  const normLi = rawLiRow ? normalizeLinkedIn(JSON.parse(rawLiRow.raw_json)) : {};
  const normIg = rawIgRow ? normalizeInstagram(JSON.parse(rawIgRow.raw_json)) : {};

  // Stage A: Extract facts & vision
  const { facts, mediaVision } = await extractFacts(personId, normLi, normIg, mediaRows);

  // Update media with visionJson
  for (const mv of mediaVision) {
    sqlite.prepare("UPDATE media SET vision_json = ? WHERE person_id = ? AND local_path = ?").run(
      JSON.stringify(mv.vision),
      personId,
      mv.localPath
    );
  }

  // Stage B: Generate Persona
  const persona = await generatePersona(personId, person.name || "Candidate", facts);

  sqlite.prepare(`
    INSERT INTO personas (id, person_id, version, model, persona_json, facts_json, created_at)
    VALUES (?, ?, 1, 'gemini', ?, ?, ?)
  `).run(crypto.randomUUID(), personId, JSON.stringify(persona), JSON.stringify(facts), Date.now());

  // Voice metrics & fidelity
  const captions = (normIg.posts || []).map((p: any) => p.caption || "").filter(Boolean);
  const metrics = calculateVoiceMetrics(captions);
  const exemplars = extractExemplars(captions);
  const styleNotes = await generateStyleNotes(personId, person.name || "Candidate", exemplars, persona.summary);
  const fidelity = await evaluateVoiceFidelity(personId, styleNotes, exemplars);

  sqlite.prepare(`
    INSERT INTO voice (id, person_id, metrics_json, style_notes, exemplars_json, fidelity_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    personId,
    JSON.stringify(metrics),
    styleNotes,
    JSON.stringify(exemplars),
    fidelity,
    Date.now()
  );

  // Initialize semantic memory
  initializeSemanticMemory(personId, persona);

  sqlite.prepare("UPDATE people SET status = 'ready', updated_at = ? WHERE id = ?").run(Date.now(), personId);
  emitEvent("pipeline:status", { stage: "read_completed", personId });
}

export async function handleRound1Dates(): Promise<void> {
  const sqlite = getSqlite();
  const people = sqlite.prepare("SELECT id FROM people WHERE status = 'ready'").all() as { id: string }[];
  if (people.length < 2) return;

  // Create all Round 1 pairs if not already created
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const aId = people[i].id < people[j].id ? people[i].id : people[j].id;
      const bId = people[i].id < people[j].id ? people[j].id : people[i].id;

      const existing = sqlite.prepare("SELECT id FROM dates WHERE a_id = ? AND b_id = ? AND round = 1").get(aId, bId) as any;
      if (!existing) {
        sqlite.prepare(`
          INSERT INTO dates (id, a_id, b_id, round, status)
          VALUES (?, ?, ?, 1, 'pending')
        `).run(crypto.randomUUID(), aId, bId);
      }
    }
  }

  // Execute all pending Round 1 dates
  const pendingDates = sqlite.prepare("SELECT id FROM dates WHERE round = 1 AND status = 'pending'").all() as { id: string }[];
  const limit = pLimit(Number(process.env.CONCURRENCY || 8));
  await Promise.all(pendingDates.map((d) => limit(() => executeDate(d.id))));
}

export async function handleReflection(): Promise<void> {
  const sqlite = getSqlite();
  const people = sqlite.prepare("SELECT id FROM people WHERE status = 'ready'").all() as { id: string }[];
  const limit = pLimit(Number(process.env.CONCURRENCY || 8));

  await Promise.all(
    people.map((person) =>
      limit(async () => {
        const personaRow = sqlite.prepare("SELECT persona_json FROM personas WHERE person_id = ?").get(person.id) as any;
        if (!personaRow) return;
        const persona = JSON.parse(personaRow.persona_json);

        // Get side reviews for this person from Round 1
        const reviewRows = sqlite.prepare(`
          SELECT review_json FROM date_reviews
          WHERE reviewer_id = ? AND review_type = 'side'
        `).all(person.id) as any[];

        const reviews = reviewRows.map((r) => JSON.parse(r.review_json));
        await runReflection(person.id, persona, reviews);
      })
    )
  );
}

export async function handleRound2Dates(): Promise<void> {
  const sqlite = getSqlite();
  const topK = Number(process.env.ROUND2_TOP_K || 6);
  const people = sqlite.prepare("SELECT id FROM people WHERE status = 'ready'").all() as { id: string }[];
  if (people.length < 2) return;

  const round2Pairs = new Set<string>();

  // For each person, find top K partners by Round 1 score
  for (const person of people) {
    const r1Scores = sqlite.prepare(`
      SELECT d.a_id, d.b_id, s.a_to_b, s.b_to_a
      FROM dates d
      JOIN scores s ON s.date_id = d.id
      WHERE (d.a_id = ? OR d.b_id = ?) AND d.round = 1
    `).all(person.id, person.id) as any[];

    const scored = r1Scores.map((row) => {
      const partnerId = row.a_id === person.id ? row.b_id : row.a_id;
      const score = row.a_id === person.id ? row.a_to_b : row.b_to_a;
      return { partnerId, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topPicks = scored.slice(0, topK);

    for (const pick of topPicks) {
      const aId = person.id < pick.partnerId ? person.id : pick.partnerId;
      const bId = person.id < pick.partnerId ? pick.partnerId : person.id;
      round2Pairs.add(`${aId}:::${bId}`);
    }
  }

  // Create and execute Round 2 dates with concurrency limit
  const limit = pLimit(Number(process.env.CONCURRENCY || 8));
  await Promise.all(
    Array.from(round2Pairs).map((pairKey) =>
      limit(async () => {
        const [aId, bId] = pairKey.split(":::");
        let dateRow = sqlite.prepare("SELECT id, status FROM dates WHERE a_id = ? AND b_id = ? AND round = 2").get(aId, bId) as any;
        if (!dateRow) {
          const id = crypto.randomUUID();
          sqlite.prepare(`
            INSERT INTO dates (id, a_id, b_id, round, status)
            VALUES (?, ?, ?, 2, 'pending')
          `).run(id, aId, bId);
          dateRow = { id, status: "pending" };
        }

        if (dateRow.status === "pending") {
          await executeDate(dateRow.id);
        }
      })
    )
  );
}
