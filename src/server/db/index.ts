import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

const dataDir = process.env.DATA_DIR || "./data";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, "app.db");

// Singleton connection across Next.js reloads
declare global {
  var _sqlite: Database.Database | undefined;
}

export function getSqlite(): Database.Database {
  if (!global._sqlite) {
    global._sqlite = new Database(dbPath, { timeout: 10000 });
    global._sqlite.pragma("busy_timeout = 10000");
    global._sqlite.pragma("journal_mode = WAL");
    global._sqlite.pragma("foreign_keys = ON");

    // Initialize FTS5 virtual table for memory search if it doesn't exist
    global._sqlite.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        id UNINDEXED,
        person_id UNINDEXED,
        kind UNINDEXED,
        content,
        source_ref UNINDEXED,
        tokenize='unicode61'
      );
    `);

    // Ensure all standard tables exist
    initTables(global._sqlite);
  }
  return global._sqlite;
}

function initTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      linkedin_url TEXT NOT NULL,
      instagram_url TEXT NOT NULL,
      name TEXT,
      headline TEXT,
      consent_status TEXT NOT NULL DEFAULT 'opted_in',
      adult_confirmed INTEGER NOT NULL DEFAULT 1,
      public_confirmed INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      identity_match REAL,
      identity_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_sources (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      original_url TEXT NOT NULL,
      local_path TEXT NOT NULL,
      caption TEXT,
      vision_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      model TEXT NOT NULL,
      persona_json TEXT NOT NULL,
      facts_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      metrics_json TEXT NOT NULL,
      style_notes TEXT,
      exemplars_json TEXT NOT NULL,
      fidelity_score REAL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      source_ref TEXT,
      date_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dates (
      id TEXT PRIMARY KEY,
      a_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      b_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      scene_json TEXT,
      started_at INTEGER,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS date_turns (
      id TEXT PRIMARY KEY,
      date_id TEXT NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
      turn_number INTEGER NOT NULL,
      speaker_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS date_reviews (
      id TEXT PRIMARY KEY,
      date_id TEXT NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL,
      review_type TEXT NOT NULL,
      review_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      date_id TEXT NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
      a_to_b REAL NOT NULL,
      b_to_a REAL NOT NULL,
      mutual REAL NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rankings (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      r1_rank INTEGER,
      r2_rank INTEGER,
      rationale_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      run_after INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_calls (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL,
      tokens_out INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      estimated INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL,
      person_id TEXT,
      date_id TEXT,
      created_at INTEGER NOT NULL
    );

    -- Useful indexes
    CREATE INDEX IF NOT EXISTS idx_dates_pair ON dates(a_id, b_id, round);
    CREATE INDEX IF NOT EXISTS idx_turns_date ON date_turns(date_id, turn_number);
    CREATE INDEX IF NOT EXISTS idx_rankings_person ON rankings(person_id, rank);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_after);
  `);
}

export const db = drizzle(getSqlite(), { schema });
export { schema };
