// app/src/lib/__tests__/db.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getDb,
  createUser,
  authenticateUser,
  insertGeneration,
  getGenerationById,
  getGenerations,
  toggleLoved,
  logApiCall,
  insertGenerationWithCall,
  getReportData,
  seedAdminIfEmpty,
  closeDb,
} from "../db";
import type {
  InsertGenerationInput,
  InsertApiCallInput,
  DateRange,
} from "../db-types";

// Use temp directory for test databases
let testDbDir: string;

describe("Database Module (db.ts)", () => {
  beforeAll(() => {
    // Create a unique temp directory for this test run
    testDbDir = path.join(os.tmpdir(), `agent1-db-test-${Date.now()}`);
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Set test DB path for all database operations
    process.env.__TEST_DB_PATH = path.join(testDbDir, `test-${Date.now()}-${Math.random()}.db`);
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

  // ─── Database Initialization ─────────────────────────────────────

  it("should initialize database with all tables", () => {
    const db = getDb();

    // Check tables exist
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("users");
    expect(tableNames).toContain("generations");
    expect(tableNames).toContain("api_calls");
    expect(tableNames).toContain("daily_stats");

    // Check indexes exist
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("idx_gen_created");
    expect(indexNames).toContain("idx_gen_provider");
    expect(indexNames).toContain("idx_gen_model");
    expect(indexNames).toContain("idx_gen_loved");
    expect(indexNames).toContain("idx_gen_active");
    expect(indexNames).toContain("idx_calls_created");
    expect(indexNames).toContain("idx_calls_gen");
  });

  // ─── User Management ─────────────────────────────────────────────

  it("should create and retrieve a user with bcrypt-hashed password", async () => {
    const db = getDb();

    const userId = await createUser({
      username: "testuser",
      password: "securepassword123",
      displayName: "Test User",
      role: "user",
    });

    expect(userId).toBeDefined();
    expect(typeof userId).toBe("string");

    // Verify password hash is NOT plain text
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId) as any;

    expect(user).toBeDefined();
    expect(user.username).toBe("testuser");
    expect(user.display_name).toBe("Test User");
    expect(user.role).toBe("user");
    expect(user.password_hash).not.toBe("securepassword123");
    expect(user.password_hash.length).toBeGreaterThan(20);
  });

  it("should authenticate a user with correct password", async () => {
    const userId = await createUser({
      username: "authtest",
      password: "correctpassword",
    });

    const authenticated = await authenticateUser("authtest", "correctpassword");

    expect(authenticated).toBeDefined();
    expect(authenticated?.id).toBe(userId);
    expect(authenticated?.username).toBe("authtest");
  });

  it("should reject authentication with incorrect password", async () => {
    await createUser({
      username: "authtest2",
      password: "correctpassword",
    });

    const authenticated = await authenticateUser("authtest2", "wrongpassword");

    expect(authenticated).toBeNull();
  });

  it("should return null for non-existent user", async () => {
    const authenticated = await authenticateUser("nonexistent", "password");
    expect(authenticated).toBeNull();
  });

  // ─── Generation Management ───────────────────────────────────────

  it("should insert and retrieve a generation", async () => {
    const userId = await createUser({
      username: "gentest",
      password: "password",
    });

    const generationInput: InsertGenerationInput = {
      userId,
      filePath: "generations/2026-03-25/image-001.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "A beautiful sunset over mountains",
      model: "nano-banana-pro",
      provider: "nano-banana",
      aspectRatio: "16:9",
      resolution: "1K",
      costUsd: 0.05,
      seed: "12345",
      metadata: {
        width: 1920,
        height: 1080,
      },
    };

    const generationId = await insertGeneration(generationInput);

    expect(generationId).toBeDefined();

    // Retrieve and verify
    const generation = getGenerationById(generationId);

    expect(generation).toBeDefined();
    expect(generation?.user_id).toBe(userId);
    expect(generation?.prompt).toBe("A beautiful sunset over mountains");
    expect(generation?.model).toBe("nano-banana-pro");
    expect(generation?.is_loved).toBe(0);
    expect(generation?.is_deleted).toBe(0);
  });

  it("should retrieve generations with filters", async () => {
    const userId = await createUser({
      username: "filtertest",
      password: "password",
    });

    // Create multiple generations
    const input1: InsertGenerationInput = {
      userId,
      filePath: "generations/2026-03-25/img1.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Test 1",
      model: "nano-banana",
      provider: "nano-banana",
      aspectRatio: "1:1",
      resolution: "1K",
      costUsd: 0.04,
    };

    const input2: InsertGenerationInput = {
      userId,
      filePath: "generations/2026-03-25/img2.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Test 2",
      model: "nano-banana-pro",
      provider: "nano-banana",
      aspectRatio: "16:9",
      resolution: "2K",
      costUsd: 0.13,
    };

    const input3: InsertGenerationInput = {
      userId,
      filePath: "generations/2026-03-25/video1.mp4",
      fileType: "video",
      mimeType: "video/mp4",
      prompt: "Test video",
      model: "veo-3.1",
      provider: "veo",
      aspectRatio: "16:9",
      resolution: "720p",
      costUsd: 0.25,
    };

    await insertGeneration(input1);
    await insertGeneration(input2);
    await insertGeneration(input3);

    // Test filters
    const nanoImages = getGenerations({
      provider: "nano-banana",
      fileType: "image",
    });

    expect(nanoImages.generations.length).toBe(2);

    const proModel = getGenerations({
      model: "nano-banana-pro",
    });

    expect(proModel.generations.length).toBe(1);

    const videos = getGenerations({
      fileType: "video",
    });

    expect(videos.generations.length).toBe(1);
  });

  // ─── Loved Status ────────────────────────────────────────────────

  it("should toggle loved status on a generation", async () => {
    const userId = await createUser({
      username: "lovedtest",
      password: "password",
    });

    const generationId = await insertGeneration({
      userId,
      filePath: "generations/2026-03-25/img.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Test",
      model: "nano-banana",
      provider: "nano-banana",
      aspectRatio: "1:1",
      resolution: "1K",
      costUsd: 0.04,
    });

    // Initially not loved
    let generation = getGenerationById(generationId);
    expect(generation?.is_loved).toBe(0);
    expect(generation?.loved_at).toBeNull();

    // Toggle to loved
    toggleLoved(generationId, true);
    generation = getGenerationById(generationId);
    expect(generation?.is_loved).toBe(1);
    expect(generation?.loved_at).toBeDefined();

    // Toggle back to not loved
    toggleLoved(generationId, false);
    generation = getGenerationById(generationId);
    expect(generation?.is_loved).toBe(0);
    expect(generation?.loved_at).toBeNull();
  });

  // ─── API Call Logging ────────────────────────────────────────────

  it("should log an API call", async () => {
    const userId = await createUser({
      username: "calltest",
      password: "password",
    });

    const callInput: InsertApiCallInput = {
      userId,
      callType: "generation",
      provider: "nano-banana",
      model: "nano-banana-pro",
      inputTokens: 100,
      outputTokens: 500,
      costUsd: 0.15,
      durationMs: 3500,
      status: "success",
    };

    const callId = logApiCall(callInput);

    expect(callId).toBeDefined();

    // Verify
    const db = getDb();
    const call = db
      .prepare("SELECT * FROM api_calls WHERE id = ?")
      .get(callId) as any;

    expect(call).toBeDefined();
    expect(call.provider).toBe("nano-banana");
    expect(call.model).toBe("nano-banana-pro");
    expect(call.cost_usd).toBe(0.15);
    expect(call.status).toBe("success");
  });

  // ─── Atomic Transaction ──────────────────────────────────────────

  it("should insert generation and API call in atomic transaction", async () => {
    const userId = await createUser({
      username: "txtest",
      password: "password",
    });

    const generationInput: InsertGenerationInput = {
      userId,
      filePath: "generations/2026-03-25/tx.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Atomic transaction test",
      model: "nano-banana",
      provider: "nano-banana",
      aspectRatio: "1:1",
      resolution: "1K",
      costUsd: 0.04,
    };

    const apiCallInput: InsertApiCallInput = {
      userId,
      callType: "generation",
      provider: "nano-banana",
      model: "nano-banana",
      costUsd: 0.04,
      durationMs: 2000,
      status: "success",
    };

    const { generationId, callId } = insertGenerationWithCall(
      generationInput,
      apiCallInput
    );

    expect(generationId).toBeDefined();
    expect(callId).toBeDefined();

    // Verify both exist
    const generation = getGenerationById(generationId);
    expect(generation).toBeDefined();

    const db = getDb();
    const call = db
      .prepare("SELECT * FROM api_calls WHERE id = ?")
      .get(callId) as any;
    expect(call).toBeDefined();

    // Verify foreign key relationship
    expect(call.generation_id).toBe(generationId);
  });

  // ─── Report Generation ──────────────────────────────────────────

  it("should generate report data for a date range", async () => {
    const userId = await createUser({
      username: "reporttest",
      password: "password",
    });

    // Create generations with different providers
    await insertGeneration({
      userId,
      filePath: "generations/2026-03-25/img1.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Test 1",
      model: "nano-banana",
      provider: "nano-banana",
      aspectRatio: "1:1",
      resolution: "1K",
      costUsd: 0.04,
    });

    await insertGeneration({
      userId,
      filePath: "generations/2026-03-25/img2.png",
      fileType: "image",
      mimeType: "image/png",
      prompt: "Test 2",
      model: "veo-3.1",
      provider: "veo",
      aspectRatio: "16:9",
      resolution: "720p",
      costUsd: 0.25,
    });

    const dateRange: DateRange = {
      from: "2026-03-24",
      to: "2026-03-26",
    };

    const report = getReportData(dateRange);

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.totalGenerations).toBeGreaterThanOrEqual(2);
    expect(report.summary.totalCostUsd).toBeGreaterThanOrEqual(0.29);

    expect(Array.isArray(report.byProvider)).toBe(true);
    expect(Array.isArray(report.byModel)).toBe(true);
    expect(Array.isArray(report.timeline)).toBe(true);
    expect(Array.isArray(report.recentCalls)).toBe(true);
  });

  // ─── Seed Admin ──────────────────────────────────────────────────

  it("should seed admin user from .env if database is empty", async () => {
    // Mock .env values
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "defaultadmin123";

    await seedAdminIfEmpty();

    const db = getDb();
    const admin = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get("admin") as any;

    expect(admin).toBeDefined();
    expect(admin.username).toBe("admin");
    expect(admin.role).toBe("admin");
  });
});
