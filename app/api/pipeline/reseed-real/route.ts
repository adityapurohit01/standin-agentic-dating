import { NextResponse } from "next/server";
import { getSqlite } from "@/server/db";
import { runFullPipeline, getPipelineStatus } from "@/server/jobs/pipeline";
import { seedRealPeople } from "@/server/reader/seed-real";

export const maxDuration = 60;

export async function POST() {
  try {
    const sqlite = getSqlite();

    // 1. Clear dates & rankings
    sqlite.prepare("DELETE FROM rankings").run();
    sqlite.prepare("DELETE FROM scores").run();
    sqlite.prepare("DELETE FROM date_reviews").run();
    sqlite.prepare("DELETE FROM date_turns").run();
    sqlite.prepare("DELETE FROM dates").run();

    // 2. Ensure real candidates are seeded
    seedRealPeople(false);

    // 3. Run full pipeline starting from Round 1 speed dates
    const res = await runFullPipeline("round1");
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    // 4. Checkpoint WAL
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } catch {}

    const status = getPipelineStatus();
    const sampleScores = sqlite.prepare("SELECT mutual, COUNT(1) as cnt FROM scores GROUP BY mutual ORDER BY mutual DESC").all();

    return NextResponse.json({
      success: true,
      status,
      scoreDistribution: sampleScores,
      message: "End-to-end pipeline completed with real candidate data",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
