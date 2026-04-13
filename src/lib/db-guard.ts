// db-guard.ts
// Safely checks if the SQLite database module is available.
// better-sqlite3 is a native C++ module that may fail to load if
// not compiled for this platform. This guard prevents the entire
// app from crashing if the module is missing.
//
// Also provides schema versioning (runMigrations), app_settings
// helpers (getSetting/setSetting), and getDbWithMigrations().

import { NextResponse } from "next/server";
import { resolve } from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BetterSqlite3Database = any;

const DB_PATH = resolve(process.cwd(), "data", "agent1.db");

let dbAvailable: boolean | null = null;

export function isDbAvailable(): boolean {
  if (dbAvailable !== null) return dbAvailable;

  try {
    require("better-sqlite3");
    dbAvailable = true;
  } catch {
    console.warn(
      "[db-guard] better-sqlite3 not available. Database features disabled. Run: npm rebuild better-sqlite3"
    );
    dbAvailable = false;
  }

  return dbAvailable;
}

export function dbUnavailableResponse() {
  return NextResponse.json(
    {
      error: "Database not available. Restart the app with start.bat / start.sh to install dependencies.",
    },
    { status: 503 }
  );
}

/**
 * Opens the database and runs any pending migrations.
 * Call this from API routes that need the database.
 * Returns null if DB is not available. Caller is responsible for closing.
 */
export function getDbWithMigrations(): BetterSqlite3Database | null {
  if (!isDbAvailable()) return null;

  let db: BetterSqlite3Database | null = null;
  try {
    const Database = require("better-sqlite3");
    db = new Database(DB_PATH);
    runMigrations(db);
    return db; // Caller is responsible for closing
  } catch {
    try { db?.close(); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Read a value from the app_settings table.
 * Safe to call even if DB is unavailable — returns null.
 * This is the canonical way to access app_settings from any module.
 */
export function getSetting(key: string): string | null {
  if (!isDbAvailable()) return null;
  let db: BetterSqlite3Database | null = null;
  try {
    const Database = require("better-sqlite3");
    const { existsSync } = require("fs");
    if (!existsSync(DB_PATH)) return null;
    // Open in read-write mode so runMigrations can create tables if needed
    db = new Database(DB_PATH);
    runMigrations(db);
    const row = db.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

/**
 * Write a value to the app_settings table.
 * Returns true on success, false on failure.
 * This is the canonical way to write app_settings from any module.
 */
export function setSetting(key: string, value: string): boolean {
  const db = getDbWithMigrations();
  if (!db) return false;
  try {
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    ).run(key, value);
    db.close();
    return true;
  } catch {
    try { db.close(); } catch { /* ignore */ }
    return false;
  }
}

// ─── Schema Versioning ─────────────────────────────────────────────

const SCHEMA_VERSION = 2;

function runMigrations(db: BetterSqlite3Database): void {
  // Ensure tracking table exists
  db.exec(`CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
  )`);

  // Ensure app_settings table exists
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const row = db.prepare("SELECT MAX(version) as v FROM _schema_version").get();
  const currentVersion = (row as { v: number | null })?.v ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  const migrations: Record<number, { fn: (d: BetterSqlite3Database) => void; desc: string }> = {
    1: {
      fn: () => { /* Tables already created above — this just tracks the version */ },
      desc: "Initialize schema versioning and app_settings",
    },
    2: {
      fn: (d: BetterSqlite3Database) => {
        d.exec(`
          CREATE TABLE IF NOT EXISTS template_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            group_key TEXT NOT NULL CHECK(group_key IN ('generation', 'task', 'provider', 'style')),
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_template_tags_group ON template_tags(group_key);
          CREATE INDEX IF NOT EXISTS idx_template_tags_active ON template_tags(is_active);
        `);
        // Seed default tags
        d.exec(`
          INSERT OR IGNORE INTO template_tags (slug, label, group_key, sort_order) VALUES
            ('image', 'Image', 'generation', 1),
            ('video', 'Video', 'generation', 2),
            ('audio', 'Audio', 'generation', 3),
            ('3d', '3D', 'generation', 4),
            ('llm', 'LLM', 'generation', 5);
          INSERT OR IGNORE INTO template_tags (slug, label, group_key, sort_order) VALUES
            ('product-shot', 'Product Shot', 'task', 1),
            ('editorial', 'Editorial', 'task', 2),
            ('character-design', 'Character Design', 'task', 3),
            ('style-transfer', 'Style Transfer', 'task', 4),
            ('background-swap', 'Background Swap', 'task', 5),
            ('sketch-to-render', 'Sketch to Render', 'task', 6),
            ('color-variations', 'Color Variations', 'task', 7),
            ('campaign', 'Campaign', 'task', 8),
            ('mood-board', 'Mood Board', 'task', 9),
            ('portrait', 'Portrait', 'task', 10),
            ('landscape', 'Landscape', 'task', 11),
            ('texture-generation', 'Texture Generation', 'task', 12),
            ('video-storyboard', 'Video Storyboard', 'task', 13),
            ('audio-tts', 'Audio / TTS', 'task', 14);
          INSERT OR IGNORE INTO template_tags (slug, label, group_key, sort_order) VALUES
            ('nano-banana', 'Nano Banana', 'provider', 1),
            ('gemini', 'Gemini', 'provider', 2),
            ('fal-ai', 'fal.ai', 'provider', 3),
            ('replicate', 'Replicate', 'provider', 4),
            ('kie-ai', 'Kie.ai', 'provider', 5),
            ('veo', 'Veo', 'provider', 6);
          INSERT OR IGNORE INTO template_tags (slug, label, group_key, sort_order) VALUES
            ('photorealistic', 'Photorealistic', 'style', 1),
            ('illustration', 'Illustration', 'style', 2),
            ('cinematic', 'Cinematic', 'style', 3),
            ('minimalist', 'Minimalist', 'style', 4),
            ('street', 'Street', 'style', 5),
            ('fashion', 'Fashion', 'style', 6);
        `);
      },
      desc: "Add template tag taxonomy with seed data",
    },
  };

  db.transaction(() => {
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const m = migrations[v];
      if (m) {
        m.fn(db);
        db.prepare(
          "INSERT INTO _schema_version (version, applied_at, description) VALUES (?, datetime('now'), ?)"
        ).run(v, m.desc);
      }
    }
  })();
}
