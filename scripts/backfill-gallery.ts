/**
 * Backfill script: populates the generations table with existing files
 * in storage/output/images/ and storage/output/videos/ that are missing from the DB.
 *
 * Run with: npx tsx scripts/backfill-gallery.ts
 *
 * This is a one-time migration to fix records that were not inserted
 * because agent1-save was using userId="admin" (string) instead of the
 * actual user UUID, causing foreign key violations.
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "data", "agent1.db");
const STORAGE_DIR = path.join(process.cwd(), "storage");

// MIME mapping
const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("Database not found at", DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Get admin user UUID
  const adminRow = db
    .prepare("SELECT id FROM users WHERE username = 'admin' LIMIT 1")
    .get() as { id: string } | undefined;

  if (!adminRow) {
    console.error("No admin user found in database. Start the app first to create one.");
    db.close();
    process.exit(1);
  }

  const adminId = adminRow.id;
  console.log(`Admin user ID: ${adminId}`);

  // Get existing file_paths in DB to avoid duplicates
  const existingPaths = new Set(
    (
      db
        .prepare("SELECT file_path FROM generations")
        .all() as Array<{ file_path: string }>
    ).map((r) => r.file_path)
  );

  console.log(`Existing DB records: ${existingPaths.size}`);

  const insertStmt = db.prepare(`
    INSERT INTO generations (
      id, user_id, file_path, file_type, mime_type, prompt, model, provider,
      aspect_ratio, resolution, cost_usd, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;

  // Scan images
  const imagesDir = path.join(STORAGE_DIR, "output", "images");
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const relPath = `output/images/${file}`;
      if (existingPaths.has(relPath)) {
        skipped++;
        continue;
      }

      const ext = path.extname(file).slice(1).toLowerCase();
      const mimeType = MIME_MAP[ext] || "image/jpeg";
      const fullPath = path.join(imagesDir, file);
      const stats = fs.statSync(fullPath);
      const createdAt = stats.mtime.toISOString();

      insertStmt.run(
        uuidv4(),
        adminId,
        relPath,
        "image",
        mimeType,
        "", // prompt unknown
        "unknown",
        "gemini",
        "1:1",
        "1K",
        0, // cost unknown for backfilled records
        "{}",
        createdAt
      );
      inserted++;
    }
  }

  // Scan videos
  const videosDir = path.join(STORAGE_DIR, "output", "videos");
  if (fs.existsSync(videosDir)) {
    const files = fs.readdirSync(videosDir).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const relPath = `output/videos/${file}`;
      if (existingPaths.has(relPath)) {
        skipped++;
        continue;
      }

      const ext = path.extname(file).slice(1).toLowerCase();
      const mimeType = MIME_MAP[ext] || "video/mp4";
      const fullPath = path.join(videosDir, file);
      const stats = fs.statSync(fullPath);
      const createdAt = stats.mtime.toISOString();

      insertStmt.run(
        uuidv4(),
        adminId,
        relPath,
        "video",
        mimeType,
        "", // prompt unknown
        "unknown",
        "unknown",
        "16:9",
        "1K",
        0, // cost unknown for backfilled records
        "{}",
        createdAt
      );
      inserted++;
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already in DB): ${skipped}`);

  db.close();
}

run();
