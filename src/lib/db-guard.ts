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

const SCHEMA_VERSION = 1;

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
