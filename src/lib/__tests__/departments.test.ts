// app/src/lib/__tests__/departments.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getDb, createUser, closeDb } from "../db";

// Use temp directory for test databases
let testDbDir: string;

describe("departments table migration", () => {
  beforeAll(() => {
    // Create a unique temp directory for this test run
    testDbDir = path.join(os.tmpdir(), `agent1-dept-test-${Date.now()}`);
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Set test DB path for all database operations
    process.env.__TEST_DB_PATH = path.join(
      testDbDir,
      `test-${Date.now()}-${Math.random()}.db`
    );
  });

  afterAll(() => {
    // Clean up test directory
    closeDb();
    try {
      if (fs.existsSync(testDbDir)) {
        const files = fs.readdirSync(testDbDir);
        files.forEach((file) => {
          const filePath = path.join(testDbDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Ignore
          }
          const walPath = `${filePath}-wal`;
          if (fs.existsSync(walPath)) {
            try {
              fs.unlinkSync(walPath);
            } catch {
              // Ignore
            }
          }
          const shmPath = `${filePath}-shm`;
          if (fs.existsSync(shmPath)) {
            try {
              fs.unlinkSync(shmPath);
            } catch {
              // Ignore
            }
          }
        });
        fs.rmdirSync(testDbDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should create departments table with correct columns", () => {
    const db = getDb();
    const tableInfo = db
      .prepare("PRAGMA table_info(departments)")
      .all() as Array<{ name: string; type: string }>;
    const columnNames = tableInfo.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("description");
    expect(columnNames).toContain("budget_monthly");
    expect(columnNames).toContain("budget_used");
    expect(columnNames).toContain("budget_period_start");
    expect(columnNames).toContain("budget_warning_threshold");
    expect(columnNames).toContain("budget_soft_limit");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("updated_at");
  });

  it("should add department_id column to users table", () => {
    const db = getDb();
    const tableInfo = db
      .prepare("PRAGMA table_info(users)")
      .all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((c) => c.name);

    expect(columnNames).toContain("department_id");
  });

  it("should allow dept_admin role in users table", async () => {
    const userId = await createUser({
      username: "dept_test",
      password: "password123",
      role: "dept_admin",
    });

    expect(userId).toBeTruthy();

    const db = getDb();
    const user = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(userId) as { role: string };

    expect(user.role).toBe("dept_admin");
  });
});
