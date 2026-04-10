import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "fs";
import { join, resolve } from "path";
import type Database from "better-sqlite3";

const STORAGE_DIR = resolve(process.cwd(), "storage");
const MARKER_FILE = join(STORAGE_DIR, ".migration-v1-complete");

/**
 * One-time idempotent migration of existing files and DB records
 * from global storage to admin user's directory.
 *
 * Strategy: COPY (not move) files + update DB paths in a transaction.
 * A marker file prevents re-execution.
 */
export function runMultiUserMigration(
  getDbFn: () => Database.Database
): void {
  if (existsSync(MARKER_FILE)) return; // Already migrated

  const db = getDbFn();

  // Get admin user
  const admin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string } | undefined;
  if (!admin) return; // Fresh install, no data to migrate

  const adminId = admin.id;
  console.log(
    `[migration] Starting multi-user migration for admin: ${adminId}`
  );

  // 1. Create target directories
  const targetDirs = [
    join(STORAGE_DIR, "users", adminId, "output", "images"),
    join(STORAGE_DIR, "users", adminId, "output", "videos"),
    join(STORAGE_DIR, "users", adminId, "output", "audio"),
    join(STORAGE_DIR, "users", adminId, "input"),
    join(STORAGE_DIR, "users", adminId, "workflows", "__session"),
  ];
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
  }

  // 2. Copy files (idempotent — skips existing)
  const copyDir = (src: string, dest: string) => {
    if (!existsSync(src)) return;
    let copied = 0;
    try {
      const files = readdirSync(src);
      for (const file of files) {
        if (file === ".gitkeep") continue;
        const srcPath = join(src, file);
        const destPath = join(dest, file);
        try {
          if (!statSync(srcPath).isFile()) continue;
          if (!existsSync(destPath)) {
            copyFileSync(srcPath, destPath);
            copied++;
          }
        } catch {
          /* skip individual file errors */
        }
      }
    } catch {
      /* skip dir errors */
    }
    if (copied > 0)
      console.log(`[migration] Copied ${copied} files from ${src}`);
  };

  copyDir(
    join(STORAGE_DIR, "output", "images"),
    join(STORAGE_DIR, "users", adminId, "output", "images")
  );
  copyDir(
    join(STORAGE_DIR, "output", "videos"),
    join(STORAGE_DIR, "users", adminId, "output", "videos")
  );
  copyDir(
    join(STORAGE_DIR, "output", "audio"),
    join(STORAGE_DIR, "users", adminId, "output", "audio")
  );
  copyDir(
    join(STORAGE_DIR, "input"),
    join(STORAGE_DIR, "users", adminId, "input")
  );
  copyDir(
    join(STORAGE_DIR, "workflows", "__session"),
    join(STORAGE_DIR, "users", adminId, "workflows", "__session")
  );

  // 3. DB updates in transaction
  const migrate = db.transaction(() => {
    // Update file paths in generations table
    db.prepare(
      `UPDATE generations SET file_path = 'users/' || ? || '/' || file_path WHERE file_path NOT LIKE 'users/%'`
    ).run(adminId);

    // Assign orphaned generations to admin
    db.prepare(
      `UPDATE generations SET user_id = ? WHERE user_id IS NULL OR user_id = 'admin'`
    ).run(adminId);

    // Assign orphaned daily_stats to admin (if column exists)
    try {
      db.prepare(`UPDATE daily_stats SET user_id = ? WHERE user_id IS NULL`).run(
        adminId
      );
    } catch {
      /* column may not exist yet */
    }
  });
  migrate();

  // 4. Write marker
  writeFileSync(
    MARKER_FILE,
    JSON.stringify({
      migratedAt: new Date().toISOString(),
      adminId,
    })
  );
  console.log("[migration] Multi-user migration complete");
}
