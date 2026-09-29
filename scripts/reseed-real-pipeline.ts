import { getSqlite } from "../src/server/db";
import { runFullPipeline, getPipelineStatus } from "../src/server/jobs/pipeline";
import { seedRealPeople } from "../src/server/reader/seed-real";

async function main() {
  console.log("=== RESETTING & RUNNING COMPLETE REAL PIPELINE ===");
  const sqlite = getSqlite();

  // 1. Clear previous dates & rankings
  sqlite.prepare("DELETE FROM rankings").run();
  sqlite.prepare("DELETE FROM scores").run();
  sqlite.prepare("DELETE FROM date_reviews").run();
  sqlite.prepare("DELETE FROM date_turns").run();
  sqlite.prepare("DELETE FROM dates").run();

  // 2. Ensure 25 real people are seeded
  console.log("Ensuring 25 real public figures are seeded...");
  seedRealPeople(false);

  // 3. Run full pipeline starting from Round 1 speed dates
  console.log("Starting full pipeline (Round 1 -> Reflect -> Round 2 -> Rank)...");
  const res = await runFullPipeline("round1");
  if (!res.success) {
    console.error("Pipeline failed:", res.error);
    process.exit(1);
  }

  // 4. Checkpoint WAL
  sqlite.pragma("wal_checkpoint(TRUNCATE)");

  const status = getPipelineStatus();
  console.log("\n=== PIPELINE RUN COMPLETE ===");
  console.log(`- Real Candidates: ${status.readyCount}`);
  console.log(`- Round 1 Dates: ${status.round1Count} / ${status.round1Total}`);
  console.log(`- Round 2 Dates: ${status.round2Count} / ${status.round2Total}`);
  console.log(`- Ranked Count: ${status.rankedCount}`);

  // Print score distribution sample
  const sampleScores = sqlite.prepare("SELECT mutual, COUNT(1) as cnt FROM scores GROUP BY mutual ORDER BY mutual DESC").all();
  console.log("Mutual Scores Distribution:", sampleScores);

  const sampleRankings = sqlite.prepare(`
    SELECT p1.name as person, p2.name as target, r.rank, r.score, r.r1_rank, r.r2_rank
    FROM rankings r
    JOIN people p1 ON p1.id = r.person_id
    JOIN people p2 ON p2.id = r.target_id
    WHERE r.person_id = (SELECT id FROM people LIMIT 1)
    ORDER BY r.rank ASC
    LIMIT 6
  `).all();
  console.log("Top 6 Matches for First Candidate:", sampleRankings);
}

main().catch(console.error);
