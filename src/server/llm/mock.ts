import { z } from "zod";
import { LLMInterface, LLMTextOptions, LLMObjectOptions, LLMVisionOptions } from "./types";
import { calculateCost } from "./pricing";
import { getSqlite } from "../db";
import crypto from "crypto";

export class MockLLM implements LLMInterface {
  private logCall(options: {
    purpose: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    personId?: string;
    dateId?: string;
    durationMs: number;
  }) {
    const sqlite = getSqlite();
    const { costUsd, estimated } = calculateCost("mock", options.tokensIn, options.tokensOut);
    sqlite.prepare(`
      INSERT INTO llm_calls (id, purpose, model, tokens_in, tokens_out, cost_usd, estimated, duration_ms, person_id, date_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      options.purpose,
      options.model,
      options.tokensIn,
      options.tokensOut,
      costUsd,
      estimated ? 1 : 0,
      options.durationMs,
      options.personId || null,
      options.dateId || null,
      Date.now()
    );
  }

  async text(options: LLMTextOptions): Promise<string> {
    const start = Date.now();
    const lastMsg = options.messages[options.messages.length - 1]?.content || "";

    let reply = "That sounds fascinating. I really value thoughtfulness and balance in how we spend our time.";
    if (options.purpose.includes("agent") || options.purpose.includes("date")) {
      const sys = options.system || "";
      const nameMatch = sys.match(/stand-in for (.*?), on a date with (.*?)\./);
      const speakerName = nameMatch ? nameMatch[1].trim() : (options.personId || "Candidate");
      const partnerName = nameMatch ? nameMatch[2].trim() : "there";

      const needsMatch = sys.match(/Core Needs:\s*(.*?)(?:\n|$)/);
      const rawNeeds = needsMatch
        ? needsMatch[1].split(",").map((s) => s.replace(/\s*\(Weight:.*?\)/, "").trim()).filter(Boolean)
        : [];
      const interestsMatch = sys.match(/Hobbies & Interests:\s*(.*?)(?:\n|$)/);
      const rawInterests = interestsMatch
        ? interestsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const valuesMatch = sys.match(/Values:\s*(.*?)(?:\n|$)/);
      const rawValues = valuesMatch
        ? valuesMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const topNeed = rawNeeds[0] || "genuine mutual curiosity";
      const secondNeed = rawNeeds[1] || "shared integrity and purpose";
      const favInterest = rawInterests[0] || "exploring deep ideas";
      const coreValue = rawValues[0] || "intellectual curiosity";

      const frictionMatch =
        lastMsg.match(/friction topic(?: is)?:?\s*"([^"]+)"/i) ||
        lastMsg.match(/friction area:?\s*"([^"]+)"/i);
      const frictionTopic = frictionMatch ? frictionMatch[1] : "demanding schedules versus spontaneous shared downtime";

      const isRound2 = options.purpose.includes("round2");
      const turnNum = options.messages.length;

      let hash = 0;
      for (let i = 0; i < speakerName.length; i++) {
        hash = (hash * 31 + speakerName.charCodeAt(i)) & 0xffffffff;
      }
      const prefersDirect = Math.abs(hash) % 2 === 0;

      if (turnNum <= 2) {
        reply = `It's so wonderful to meet you, ${partnerName}. I was really drawn to this setting—it gives us space to have an authentic conversation. When you have free time away from work, what kind of activities or passions like ${favInterest} truly energize you?`;
      } else if (turnNum <= 4) {
        reply = `I really appreciate that, ${partnerName}. A core priority for me is ${topNeed}. Whether I'm focusing on ${favInterest} or investing in personal growth, having honest alignment on ${coreValue} matters immensely. How do you approach that in your own life?`;
      } else if (turnNum <= (isRound2 ? 10 : 6)) {
        if (prefersDirect) {
          reply = `That brings up an important point around ${frictionTopic}. Staying true to ${coreValue}, I value open communication and direct clarity over letting unaddressed concerns build up. If our priorities diverge, how would you prefer we resolve that?`;
        } else {
          reply = `When navigating ${frictionTopic}, I look for thoughtful empathy and patience. We don't have to agree on every single routine, but ensuring mutual support for ${secondNeed} is something that creates lasting trust.`;
        }
      } else {
        reply = `Hearing your thoughts gives me a much deeper appreciation for who you are, ${partnerName}. I've genuinely loved our conversation—it's inspiring to connect with someone who cares about ${topNeed} and brings such authentic presence.`;
      }
    } else if (options.purpose.includes("chat")) {
      reply = "Hey there! Thanks for reaching out. Based on my notes, I'm always open to discussing new ideas, tech, or our favorite weekend travel spots.";
    }

    this.logCall({
      purpose: options.purpose,
      model: options.model || "mock",
      tokensIn: 150,
      tokensOut: 60,
      personId: options.personId,
      dateId: options.dateId,
      durationMs: Date.now() - start,
    });

    return reply;
  }

  async object<T extends z.ZodTypeAny>(options: LLMObjectOptions<T>): Promise<z.infer<T>> {
    const start = Date.now();
    const p = options.purpose.toLowerCase();
    let sample: any = {};

    if (p.includes("moderator") || p.includes("scene")) {
      const scenes = [
        "A sunlit cafe corner near a botanical conservatory, surrounded by rare ferns and fresh espresso aromas.",
        "An intimate rooftop terrace overlooking the illuminated bay skyline as dusk settles over the water.",
        "A quiet corner of an independent design bookstore and gallery with courtyard seating and pour-over tea.",
        "A rustic coastal lookout cafe along the cliffs, listening to waves crashing against the rocky shore.",
        "A warm farm-to-table tasting room with vinyl jazz records spinning softly in the background.",
        "A serene Japanese tea house tucked beside a peaceful stone garden and bamboo grove.",
      ];
      let seed = 0;
      const keyStr = (options.dateId || options.prompt || "date");
      for (let i = 0; i < keyStr.length; i++) seed += keyStr.charCodeAt(i);
      sample = {
        scene: scenes[seed % scenes.length],
        opening_topic: "Balancing creative pursuits, personal discipline, and weekend routines.",
        friction_topic: "Navigating demanding career sprints versus spontaneous shared downtime.",
        why: "Both candidates express a strong commitment to their craft while valuing thoughtful conversation.",
      };
    } else if (p.includes("vision")) {
      sample = {
        activities: ["hiking", "photography"],
        setting: "mountain trail during golden hour",
        people_count: 1,
        mood: "serene and adventurous",
        objects: ["camera", "hiking backpack"],
        notable: "High altitude landscape shot with natural lighting.",
      };
    } else if (p.includes("persona")) {
      const personId = options.personId || "";
      sample = {
        identity: {
          name: "Candidate",
          headline: "Product Strategist & Mountain Enthusiast",
          location: "San Francisco, CA",
          current_role: "Staff Product Manager",
          company: "Apex Tech",
          education: ["B.S. in Computer Science, UC Berkeley"],
        },
        summary: "A deliberate and curious strategist who thrives on complex problem solving during the week and backcountry exploration on weekends. Values transparent communication and intentional living over superficial hype.",
        needs: [
          { need: "Mutual respect for demanding creative work", kind: "inferred", weight: 5, confidence: 0.9, evidence: ["li:exp:1", "li:about"] },
          { need: "Shared love for outdoor adventure and active weekends", kind: "stated", weight: 4, confidence: 0.85, evidence: ["ig:post:1", "ig:bio"] },
          { need: "Direct, mature emotional communication", kind: "inferred", weight: 4, confidence: 0.8, evidence: ["li:about"] },
        ],
        hobbies: [
          { name: "Backpacking & Trail Running", confidence: 0.95, evidence: ["ig:post:1", "ig:post:2"] },
          { name: "Specialty Coffee Brewing", confidence: 0.85, evidence: ["ig:post:3"] },
        ],
        interests: [
          { name: "Distributed Systems & AI Architecture", confidence: 0.9, evidence: ["li:exp:1"] },
          { name: "Sustainable Architecture", confidence: 0.75, evidence: ["ig:post:4"] },
        ],
        values: [
          { name: "Integrity and Follow-Through", confidence: 0.9, evidence: ["li:about"] },
          { name: "Curiosity and Lifelong Learning", confidence: 0.85, evidence: ["li:edu:1"] },
        ],
        lifestyle: {
          rhythm: "Early riser with structured mornings and spontaneous weekend trips.",
          social_energy: "Ambivert: energized by thoughtful one-on-one dinners and trail runs.",
          travel: "Preference for rugged national parks and cultural walking tours.",
          fitness: "Consistent daily training, trail running, bouldering.",
          food: "Enjoys cooking whole foods and trying local farm-to-table spots.",
          other: "Avoids loud nightlife venues in favor of conversational gatherings.",
        },
        ambition: {
          level: "High",
          direction: "Building durable technology products with societal utility.",
          evidence: ["li:exp:1"],
        },
        humor: {
          style: "Dry, witty, and self-aware.",
          evidence: ["ig:bio", "ig:post:2"],
        },
        communication_style: {
          summary: "Articulate, concise, asks thoughtful questions, listens attentively.",
          evidence: ["li:about"],
        },
        relationship_signals: [
          { signal: "Looking for equal partnership with emotional maturity", confidence: 0.5, evidence: ["li:about"] },
        ],
        friction_points: [
          { point: "May prioritize deep focus time over frequent casual messaging", why: "Strong focus on deep work periods", evidence: ["li:exp:1"] },
          { point: "Prefers active outdoor weekends rather than staying indoors all day", why: "High fitness and trail orientation", evidence: ["ig:post:1"] },
        ],
        green_flags: [
          { flag: "Long-term dedication to projects and community", evidence: ["li:exp:1"] },
          { flag: "Clear boundaries between work time and personal recreation", evidence: ["ig:bio"] },
        ],
        unknowns: [
          "Specific long-term family timeline or relocation preferences",
          "Everyday conflict resolution habits in private settings",
        ],
      };
    } else if (p.includes("side") || (p.includes("review") && !p.includes("judge"))) {
      // NOTE: In the new architecture, mock side reviews are computed by
      // deriveMockSideReview() in review.ts, which reads the actual transcript.
      // This branch is a schema-valid fallback only; it should not be the primary path.
      sample = {
        need_scores: [
          { need: "Fallback need", score: 5, turns: [1] },
        ],
        values_alignment: 5,
        chemistry: 5,
        red_flags: [],
        green_flags: [
          { text: "Mock fallback — transcript-derived scores are in review.ts", turns: [1] },
        ],
        would_see_again: 50,
        learned_about_principal: [
          "Mock LLM fallback — real scoring derives from transcript in review.ts",
        ],
        summary: "Mock LLM fallback review. Transcript-derived scoring is handled by deriveMockSideReview().",
      };
    } else if (p.includes("judge")) {
      // NOTE: In the new architecture, mock judge reviews are computed by
      // deriveMockJudgeReview() in judge.ts, which reads the actual transcript.
      // This branch is a schema-valid fallback only.
      sample = {
        mutual_score: 50,
        rationale: "Mock LLM fallback — transcript-derived scoring is in judge.ts deriveMockJudgeReview().",
        shared_ground: [
          "Mock fallback",
        ],
        friction: [
          "Mock fallback",
        ],
        best_turns: [1, 2],
        verdict: "Mock LLM fallback. Transcript-derived judge scoring is handled by deriveMockJudgeReview().",
      };
    } else if (p.includes("factcheck") || p.includes("fact-check")) {
      sample = {
        unsupported_claims: [],
      };
    } else if (p.includes("reflect")) {
      sample = {
        need_weight_changes: [
          { need: "Shared love for outdoor adventure", old_weight: 4, new_weight: 5, reason: "Speed dates proved shared physical energy is essential for rapport." },
        ],
        new_must_haves: ["Clear communication about weekend schedules"],
        new_dealbreakers: ["Dismissiveness toward dedicated focus time"],
        lessons: [
          "Look for emotional reciprocity early in conversation rather than waiting for formal questions.",
        ],
      };
    } else if (p.includes("fidelity")) {
      sample = {
        chosen_index: 0,
        confidence: 0.55,
        rationale: "The phrasing in caption A reflects the natural cadence observed in the profile.",
      };
    } else {
      sample = {
        result: "success",
        score: 80,
      };
    }

    // Validate with provided schema, fallback repair if needed
    const parsed = options.schema.safeParse(sample);
    if (!parsed.success) {
      // Return raw sample if Zod passthrough allowed, or throw
      throw new Error(`Mock LLM sample failed schema validation: ${parsed.error.message}`);
    }

    this.logCall({
      purpose: options.purpose,
      model: options.model || "mock",
      tokensIn: 300,
      tokensOut: 200,
      personId: options.personId,
      dateId: options.dateId,
      durationMs: Date.now() - start,
    });

    return parsed.data;
  }

  async vision<T extends z.ZodTypeAny>(options: LLMVisionOptions<T>): Promise<z.infer<T>> {
    return this.object({
      schema: options.schema,
      prompt: options.prompt,
      model: options.model || "mock-vision",
      purpose: options.purpose,
      personId: options.personId,
    });
  }
}
