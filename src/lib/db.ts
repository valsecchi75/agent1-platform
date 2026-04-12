// app/src/lib/db.ts
// Core database module using better-sqlite3
// All operations are synchronous for simplicity and consistency

import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type {
  DbUser,
  DbGeneration,
  DbApiCall,
  DbDailyStat,
  CreateUserInput,
  InsertGenerationInput,
  InsertApiCallInput,
  GenerationFilters,
  DateRange,
  ReportData,
  ReportSummary,
  AllTimeSummary,
  ProviderBreakdown,
  ModelBreakdown,
  DailyTimelinePoint,
  GenerationListResponse,
} from "./db-types";

// ─── Singleton Database Connection ──────────────────────────────

let dbInstance: Database.Database | null = null;
let lastDbPath: string | null = null;

function getDatabasePath(): string {
  // For tests, use the test DB path
  if (process.env.__TEST_DB_PATH) {
    return process.env.__TEST_DB_PATH;
  }

  // For production, use data/agent1.db
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "agent1.db");
}

export function getDb(): Database.Database {
  const dbPath = getDatabasePath();

  // If DB path changed (e.g., in tests), close old instance
  if (lastDbPath && lastDbPath !== dbPath && dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore
    }
    dbInstance = null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(dbPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  lastDbPath = dbPath;

  // Enable WAL mode for better concurrency
  dbInstance.pragma("journal_mode = WAL");

  // Enable foreign keys
  dbInstance.pragma("foreign_keys = ON");

  // Initialize schema if needed
  initializeSchema(dbInstance);

  // Run migrations
  migrateDepartmentSupport(dbInstance);

  return dbInstance;
}

// ─── Schema Initialization ──────────────────────────────────────

function initializeSchema(db: Database.Database): void {
  // Create departments table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      budget_monthly REAL DEFAULT 0,
      budget_warning_threshold REAL DEFAULT 0.8,
      budget_soft_limit REAL DEFAULT 0,
      budget_used REAL DEFAULT 0,
      budget_period_start TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'dept_admin', 'user')),
      department_id TEXT REFERENCES departments(id),
      created_at TEXT NOT NULL,
      last_login_at TEXT
    )
  `);

  // Create generations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK(file_type IN ('image', 'video')),
      mime_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      workflow_name TEXT,
      workflow_id TEXT,
      node_id TEXT,
      aspect_ratio TEXT NOT NULL,
      resolution TEXT NOT NULL,
      cost_usd REAL NOT NULL DEFAULT 0,
      seed TEXT,
      is_loved INTEGER DEFAULT 0 CHECK(is_loved IN (0, 1)),
      loved_at TEXT,
      is_deleted INTEGER DEFAULT 0 CHECK(is_deleted IN (0, 1)),
      deleted_at TEXT,
      workflow_json TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create api_calls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_calls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      generation_id TEXT,
      call_type TEXT NOT NULL CHECK(call_type IN ('generation', 'llm_analysis', 'vision', 'prompt_compilation')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('success', 'error')),
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE SET NULL
    )
  `);

  // Create daily_stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_generations INTEGER NOT NULL DEFAULT 0,
      total_api_calls INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      generations_by_provider TEXT NOT NULL DEFAULT '{}',
      cost_by_provider TEXT NOT NULL DEFAULT '{}',
      cost_by_model TEXT NOT NULL DEFAULT '{}'
    )
  `);

  // Create user_sessions table (persist editor tab state across restarts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gen_created ON generations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gen_provider ON generations(provider);
    CREATE INDEX IF NOT EXISTS idx_gen_model ON generations(model);
    CREATE INDEX IF NOT EXISTS idx_gen_loved ON generations(is_loved);
    CREATE INDEX IF NOT EXISTS idx_gen_active ON generations(is_deleted, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gen_workflow ON generations(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_calls_created ON api_calls(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calls_gen ON api_calls(generation_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
  `);
}

// ─── Migration: Department Support ──────────────────────────────

function migrateDepartmentSupport(db: Database.Database): void {
  try {
    // Check if department_id column exists
    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasDepartmentId = tableInfo.some(col => col.name === "department_id");

    if (!hasDepartmentId) {
      console.log("[migration] Adding department_id column to users table");
      db.exec(`
        ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id);
      `);
    }
  } catch (error) {
    console.warn("[migration] Department support check failed (may already exist):", error);
  }
}

// ─── User Management ────────────────────────────────────────────

export async function createUser(input: CreateUserInput): Promise<string> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Hash password with bcryptjs (cost 12 for good security/performance balance)
  const passwordHash = await bcrypt.hash(input.password, 12);

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, department_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.username,
    passwordHash,
    input.displayName || null,
    input.role || "user",
    input.departmentId || null,
    now
  );

  return id;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<DbUser | null> {
  const db = getDb();

  const stmt = db.prepare(
    "SELECT * FROM users WHERE username = ? LIMIT 1"
  );
  const user = stmt.get(username) as DbUser | undefined;

  if (!user) {
    return null;
  }

  // Verify password hash
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  // Update last login
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, user.id);

  return user;
}

export function getUserById(userId: string): DbUser | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
  const user = stmt.get(userId) as DbUser | undefined;
  return user || null;
}

export function getUserCount(): number {
  const db = getDb();
  const result = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  return result.count;
}

export function updateLastLogin(userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, userId);
}

export function listUsers(): DbUser[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
  return stmt.all() as DbUser[];
}

export function updateUser(userId: string, updates: { displayName?: string | null; role?: string; departmentId?: string | null }): void {
  const db = getDb();

  const updateFields: string[] = [];
  const values: unknown[] = [];

  if (updates.displayName !== undefined) {
    updateFields.push("display_name = ?");
    values.push(updates.displayName);
  }
  if (updates.role !== undefined) {
    updateFields.push("role = ?");
    values.push(updates.role);
  }
  if (updates.departmentId !== undefined) {
    updateFields.push("department_id = ?");
    values.push(updates.departmentId);
  }

  if (updateFields.length === 0) return;

  values.push(userId);

  const sql = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...values);
}

export function deleteUser(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

// ─── Generation Management ──────────────────────────────────────

export async function insertGeneration(
  input: InsertGenerationInput
): Promise<string> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO generations (
      id, user_id, file_path, file_type, mime_type, prompt, model, provider,
      workflow_name, workflow_id, node_id, aspect_ratio, resolution,
      cost_usd, seed, workflow_json, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.userId,
    input.filePath,
    input.fileType,
    input.mimeType,
    input.prompt,
    input.model,
    input.provider,
    input.workflowName || null,
    input.workflowId || null,
    input.nodeId || null,
    input.aspectRatio,
    input.resolution,
    input.costUsd,
    input.seed || null,
    input.workflowJson || null,
    JSON.stringify(input.metadata || {}),
    now
  );

  return id;
}

export function getGenerationById(id: string): DbGeneration | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM generations WHERE id = ? LIMIT 1");
  const generation = stmt.get(id) as DbGeneration | undefined;
  return generation || null;
}

export function getGenerations(
  filters: GenerationFilters
): GenerationListResponse {
  const db = getDb();

  // Build WHERE clause dynamically based on filters
  const whereClauses: string[] = ["is_deleted = 0"];
  const params: unknown[] = [];

  if (filters.provider) {
    whereClauses.push("provider = ?");
    params.push(filters.provider);
  }

  if (filters.model) {
    whereClauses.push("model = ?");
    params.push(filters.model);
  }

  if (filters.fileType) {
    whereClauses.push("file_type = ?");
    params.push(filters.fileType);
  }

  if (filters.isLoved !== undefined) {
    whereClauses.push("is_loved = ?");
    params.push(filters.isLoved ? 1 : 0);
  }

  if (filters.dateFrom) {
    whereClauses.push("DATE(created_at) >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    whereClauses.push("DATE(created_at) <= ?");
    params.push(filters.dateTo);
  }

  const whereClause = whereClauses.join(" AND ");

  // Get total count
  const countStmt = db.prepare(
    `SELECT COUNT(*) as count FROM generations WHERE ${whereClause}`
  );
  const countResult = countStmt.get(...params) as { count: number };

  // Get paginated results
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const stmt = db.prepare(
    `SELECT * FROM generations
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  );

  const generations = stmt.all(...params, limit, offset) as DbGeneration[];

  return {
    generations,
    total: countResult.count,
    hasMore: offset + limit < countResult.count,
  };
}

export function getGenerationsCount(filters: GenerationFilters): number {
  const db = getDb();

  const whereClauses: string[] = ["is_deleted = 0"];
  const params: unknown[] = [];

  if (filters.provider) {
    whereClauses.push("provider = ?");
    params.push(filters.provider);
  }

  if (filters.model) {
    whereClauses.push("model = ?");
    params.push(filters.model);
  }

  if (filters.fileType) {
    whereClauses.push("file_type = ?");
    params.push(filters.fileType);
  }

  if (filters.isLoved !== undefined) {
    whereClauses.push("is_loved = ?");
    params.push(filters.isLoved ? 1 : 0);
  }

  const whereClause = whereClauses.join(" AND ");

  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM generations WHERE ${whereClause}`
  );
  const result = stmt.get(...params) as { count: number };

  return result.count;
}

export function toggleLoved(generationId: string, isLoved: boolean): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (isLoved) {
    db.prepare(
      "UPDATE generations SET is_loved = 1, loved_at = ? WHERE id = ?"
    ).run(now, generationId);
  } else {
    db.prepare(
      "UPDATE generations SET is_loved = 0, loved_at = NULL WHERE id = ?"
    ).run(generationId);
  }
}

export function softDeleteGeneration(generationId: string): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE generations SET is_deleted = 1, deleted_at = ? WHERE id = ?"
  ).run(now, generationId);
}

export function getGenerationFilePath(generationId: string): string | null {
  const db = getDb();
  const stmt = db.prepare("SELECT file_path FROM generations WHERE id = ?");
  const result = stmt.get(generationId) as { file_path: string } | undefined;
  return result?.file_path || null;
}

// ─── API Call Logging ───────────────────────────────────────────

export function logApiCall(input: InsertApiCallInput): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO api_calls (
      id, user_id, generation_id, call_type, provider, model,
      input_tokens, output_tokens, cost_usd, duration_ms,
      status, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.userId,
    input.generationId || null,
    input.callType,
    input.provider,
    input.model,
    input.inputTokens || 0,
    input.outputTokens || 0,
    input.costUsd,
    input.durationMs,
    input.status,
    input.errorMessage || null,
    now
  );

  return id;
}

// ─── Atomic Transactions ────────────────────────────────────────

export function insertGenerationWithCall(
  generationInput: InsertGenerationInput,
  apiCallInput: InsertApiCallInput
): { generationId: string; callId: string } {
  const db = getDb();

  // Use transaction for atomic operation
  const transaction = db.transaction(() => {
    const generationId = uuidv4();
    const callId = uuidv4();
    const now = new Date().toISOString();

    // Insert generation
    const genStmt = db.prepare(`
      INSERT INTO generations (
        id, user_id, file_path, file_type, mime_type, prompt, model, provider,
        workflow_name, workflow_id, node_id, aspect_ratio, resolution,
        cost_usd, seed, workflow_json, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    genStmt.run(
      generationId,
      generationInput.userId,
      generationInput.filePath,
      generationInput.fileType,
      generationInput.mimeType,
      generationInput.prompt,
      generationInput.model,
      generationInput.provider,
      generationInput.workflowName || null,
      generationInput.workflowId || null,
      generationInput.nodeId || null,
      generationInput.aspectRatio,
      generationInput.resolution,
      generationInput.costUsd,
      generationInput.seed || null,
      generationInput.workflowJson || null,
      JSON.stringify(generationInput.metadata || {}),
      now
    );

    // Insert API call with generation_id reference
    const callStmt = db.prepare(`
      INSERT INTO api_calls (
        id, user_id, generation_id, call_type, provider, model,
        input_tokens, output_tokens, cost_usd, duration_ms,
        status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    callStmt.run(
      callId,
      apiCallInput.userId,
      generationId,
      apiCallInput.callType,
      apiCallInput.provider,
      apiCallInput.model,
      apiCallInput.inputTokens || 0,
      apiCallInput.outputTokens || 0,
      apiCallInput.costUsd,
      apiCallInput.durationMs,
      apiCallInput.status,
      apiCallInput.errorMessage || null,
      now
    );

    return { generationId, callId };
  });

  return transaction();
}

// ─── Daily Statistics ───────────────────────────────────────────

export function refreshDailyStats(date: string): void {
  const db = getDb();

  // Get statistics for the date
  const generationsResult = db
    .prepare(`
      SELECT
        COUNT(*) as total,
        provider,
        SUM(cost_usd) as cost
      FROM generations
      WHERE DATE(created_at) = ? AND is_deleted = 0
      GROUP BY provider
    `)
    .all(date) as Array<{ total: number; provider: string; cost: number }>;

  const totalGenerations = generationsResult.reduce(
    (sum, r) => sum + r.total,
    0
  );
  const totalCost = generationsResult.reduce(
    (sum, r) => sum + (r.cost || 0),
    0
  );

  const generationsByProvider: Record<string, number> = {};
  const costByProvider: Record<string, number> = {};

  generationsResult.forEach((r) => {
    generationsByProvider[r.provider] = r.total;
    costByProvider[r.provider] = r.cost || 0;
  });

  // Get model breakdown
  const modelsResult = db
    .prepare(`
      SELECT
        model,
        COUNT(*) as total,
        SUM(cost_usd) as cost
      FROM generations
      WHERE DATE(created_at) = ? AND is_deleted = 0
      GROUP BY model
    `)
    .all(date) as Array<{ model: string; total: number; cost: number }>;

  const costByModel: Record<string, number> = {};

  modelsResult.forEach((r) => {
    costByModel[r.model] = r.cost || 0;
  });

  // Get API call count
  const apiCallsResult = db
    .prepare(`
      SELECT COUNT(*) as total
      FROM api_calls
      WHERE DATE(created_at) = ?
    `)
    .get(date) as { total: number };

  // Upsert daily stats
  const stmt = db.prepare(`
    INSERT INTO daily_stats (
      date, total_generations, total_api_calls, total_cost_usd,
      generations_by_provider, cost_by_provider, cost_by_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_generations = excluded.total_generations,
      total_api_calls = excluded.total_api_calls,
      total_cost_usd = excluded.total_cost_usd,
      generations_by_provider = excluded.generations_by_provider,
      cost_by_provider = excluded.cost_by_provider,
      cost_by_model = excluded.cost_by_model
  `);

  stmt.run(
    date,
    totalGenerations,
    apiCallsResult.total,
    totalCost,
    JSON.stringify(generationsByProvider),
    JSON.stringify(costByProvider),
    JSON.stringify(costByModel)
  );
}

// ─── Report Generation ──────────────────────────────────────────

export function getReportData(dateRange: DateRange): ReportData {
  const db = getDb();
  const { from, to } = dateRange;

  // Calculate previous period for comparison
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const rangeDays =
    Math.floor(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  const prevFromDate = new Date(fromDate);
  prevFromDate.setDate(prevFromDate.getDate() - rangeDays);
  const prevToDate = new Date(fromDate);
  prevToDate.setDate(prevToDate.getDate() - 1);

  const prevFrom = prevFromDate.toISOString().split("T")[0];
  const prevTo = prevToDate.toISOString().split("T")[0];

  // Current period summary
  const summaryResult = db
    .prepare(`
      SELECT
        COUNT(*) as total_generations,
        SUM(cost_usd) as total_cost
      FROM generations
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND is_deleted = 0
    `)
    .get(from, to) as { total_generations: number; total_cost: number };

  const apiCallsResult = db
    .prepare(`
      SELECT COUNT(*) as total_calls
      FROM api_calls
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `)
    .get(from, to) as { total_calls: number };

  const totalGenerations = summaryResult.total_generations || 0;
  const totalCostUsd = summaryResult.total_cost || 0;
  const totalApiCalls = apiCallsResult.total_calls || 0;

  const avgCostPerGeneration = totalGenerations > 0 ? totalCostUsd / totalGenerations : 0;

  // Previous period summary
  const prevResult = db
    .prepare(`
      SELECT
        COUNT(*) as total_generations,
        SUM(cost_usd) as total_cost
      FROM generations
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND is_deleted = 0
    `)
    .get(prevFrom, prevTo) as { total_generations: number; total_cost: number };

  const prevGenerations = prevResult.total_generations || 0;
  const prevCostUsd = prevResult.total_cost || 0;

  const summary: ReportSummary = {
    totalGenerations,
    totalApiCalls,
    totalCostUsd,
    avgCostPerGeneration,
    previousPeriod: {
      totalGenerations: prevGenerations,
      totalCostUsd: prevCostUsd,
    },
  };

  // Provider breakdown
  const providerResults = db
    .prepare(`
      SELECT
        provider,
        COUNT(*) as count,
        SUM(cost_usd) as cost
      FROM generations
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND is_deleted = 0
      GROUP BY provider
      ORDER BY cost DESC
    `)
    .all(from, to) as Array<{ provider: string; count: number; cost: number }>;

  const byProvider: ProviderBreakdown[] = providerResults.map((r) => ({
    provider: r.provider,
    count: r.count,
    costUsd: r.cost || 0,
  }));

  // Model breakdown
  const modelResults = db
    .prepare(`
      SELECT
        model,
        provider,
        COUNT(*) as count,
        SUM(cost_usd) as cost
      FROM generations
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND is_deleted = 0
      GROUP BY model, provider
      ORDER BY cost DESC
    `)
    .all(from, to) as Array<{
    model: string;
    provider: string;
    count: number;
    cost: number;
  }>;

  const byModel: ModelBreakdown[] = modelResults.map((r) => ({
    model: r.model,
    provider: r.provider,
    count: r.count,
    costUsd: r.cost || 0,
  }));

  // Timeline
  const timelineResults = db
    .prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as generations,
        SUM(cost_usd) as cost
      FROM generations
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND is_deleted = 0
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)
    .all(from, to) as Array<{ date: string; generations: number; cost: number }>;

  const timeline: DailyTimelinePoint[] = timelineResults.map((r) => ({
    date: r.date,
    generations: r.generations,
    costUsd: r.cost || 0,
  }));

  // Recent API calls
  const recentCallsResults = db
    .prepare(`
      SELECT * FROM api_calls
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
      ORDER BY created_at DESC
      LIMIT 50
    `)
    .all(from, to) as DbApiCall[];

  // All-time summary (regardless of date range)
  const allTimeGenResult = db
    .prepare(`
      SELECT
        COUNT(*) as total_generations,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        MIN(created_at) as first_date
      FROM generations
      WHERE is_deleted = 0
    `)
    .get() as { total_generations: number; total_cost: number; first_date: string | null };

  const allTimeCallsResult = db
    .prepare(`SELECT COUNT(*) as total_calls FROM api_calls`)
    .get() as { total_calls: number };

  const allTime: AllTimeSummary = {
    totalGenerations: allTimeGenResult.total_generations || 0,
    totalCostUsd: allTimeGenResult.total_cost || 0,
    totalApiCalls: allTimeCallsResult.total_calls || 0,
    firstGenerationDate: allTimeGenResult.first_date
      ? allTimeGenResult.first_date.split("T")[0]
      : null,
  };

  return {
    summary,
    allTime,
    byProvider,
    byModel,
    timeline,
    recentCalls: recentCallsResults,
  };
}

// ─── Seeding & Cleanup ──────────────────────────────────────────

export async function seedAdminIfEmpty(): Promise<void> {
  const userCount = getUserCount();

  if (userCount > 0) {
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";

  await createUser({
    username: adminUsername,
    password: adminPassword,
    displayName: "Administrator",
    role: "admin",
  });
}

export function cleanupTrash(daysOld: number = 7): number {
  const db = getDb();

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();

  // Soft delete is already done, so just delete old records permanently
  const stmt = db.prepare(`
    DELETE FROM generations
    WHERE is_deleted = 1 AND deleted_at < ?
  `);

  const result = stmt.run(cutoffISO);

  return result.changes;
}

// ─── Session Persistence ─────────────────────────────────────────

/**
 * Save the user's editor session (tab state) to the DB.
 * Uses upsert: one row per user.
 */
export function saveUserSession(userId: string, sessionData: object): void {
  const db = getDb();
  const now = new Date().toISOString();
  const json = JSON.stringify(sessionData);

  // Verify the user exists before inserting (avoids FK constraint failure
  // when seedAdminIfEmpty() hasn't completed yet on first launch)
  const userExists = db
    .prepare("SELECT 1 FROM users WHERE id = ? LIMIT 1")
    .get(userId);

  if (!userExists) {
    // User not seeded yet — skip silently, next persist call will succeed
    return;
  }

  db.prepare(`
    INSERT INTO user_sessions (id, user_id, session_data, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET session_data = excluded.session_data, updated_at = excluded.updated_at
  `).run(userId, userId, json, now);
}

/**
 * Load the user's last saved session from the DB.
 */
export function loadUserSession(userId: string): object | null {
  const db = getDb();
  const row = db
    .prepare("SELECT session_data FROM user_sessions WHERE user_id = ? LIMIT 1")
    .get(userId) as { session_data: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.session_data);
  } catch {
    return null;
  }
}

// ─── Last Workflow Lookup ────────────────────────────────────────

/**
 * Get the most recent generation that has a workflow_id and workflow_json,
 * so we can re-open the user's last productive workflow.
 */
export function getLastGenerationWorkflow(): {
  workflowId: string;
  workflowName: string | null;
  workflowJson: string;
  saveDirectoryPath: string | null;
  createdAt: string;
} | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT workflow_id, workflow_name, workflow_json, metadata_json, created_at
      FROM generations
      WHERE is_deleted = 0
        AND workflow_id IS NOT NULL
        AND workflow_json IS NOT NULL
        AND workflow_json != ''
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get() as {
      workflow_id: string;
      workflow_name: string | null;
      workflow_json: string;
      metadata_json: string;
      created_at: string;
    } | undefined;

  if (!row) return null;

  // Try to extract directoryPath from metadata
  let saveDirectoryPath: string | null = null;
  try {
    const meta = JSON.parse(row.metadata_json || "{}");
    saveDirectoryPath = meta.saveDirectoryPath || null;
  } catch { /* ignore */ }

  return {
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    workflowJson: row.workflow_json,
    saveDirectoryPath,
    createdAt: row.created_at,
  };
}

// ─── Utility: Close Database ────────────────────────────────────

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
