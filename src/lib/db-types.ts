// app/src/lib/db-types.ts
// Type definitions for all database entities

// ─── Users ───────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  role: "admin" | "user";
  created_at: string; // ISO 8601
  last_login_at: string | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  displayName?: string;
  role?: "admin" | "user";
}

// ─── Generations ─────────────────────────────────────────────────

export interface DbGeneration {
  id: string;
  user_id: string;
  file_path: string; // relative to app/data/
  file_type: "image" | "video";
  mime_type: string;
  prompt: string;
  model: string;
  provider: string;
  workflow_name: string | null;
  workflow_id: string | null;
  node_id: string | null;
  aspect_ratio: string;
  resolution: string;
  cost_usd: number;
  seed: string | null;
  is_loved: 0 | 1;
  loved_at: string | null;
  is_deleted: 0 | 1;
  deleted_at: string | null;
  workflow_json: string | null;
  metadata_json: string;
  created_at: string;
}

export interface InsertGenerationInput {
  userId: string;
  filePath: string;
  fileType: "image" | "video";
  mimeType: string;
  prompt: string;
  model: string;
  provider: string;
  workflowName?: string;
  workflowId?: string;
  nodeId?: string;
  aspectRatio: string;
  resolution: string;
  costUsd: number;
  seed?: string;
  workflowJson?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationFilters {
  provider?: string;
  model?: string;
  fileType?: "image" | "video";
  isLoved?: boolean;
  dateFrom?: string; // ISO date
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// ─── API Calls ───────────────────────────────────────────────────

export type ApiCallType = "generation" | "llm_analysis" | "vision" | "prompt_compilation";

export interface DbApiCall {
  id: string;
  user_id: string;
  generation_id: string | null;
  call_type: ApiCallType;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
  status: "success" | "error";
  error_message: string | null;
  created_at: string;
}

export interface InsertApiCallInput {
  userId: string;
  generationId?: string;
  callType: ApiCallType;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage?: string;
}

// ─── Daily Stats ─────────────────────────────────────────────────

export interface DbDailyStat {
  date: string; // YYYY-MM-DD
  total_generations: number;
  total_api_calls: number;
  total_cost_usd: number;
  generations_by_provider: string; // JSON
  cost_by_provider: string; // JSON
  cost_by_model: string; // JSON
}

// ─── Reports ─────────────────────────────────────────────────────

export interface DateRange {
  from: string; // ISO date
  to: string;
}

export interface ReportSummary {
  totalGenerations: number;
  totalApiCalls: number;
  totalCostUsd: number;
  avgCostPerGeneration: number;
  previousPeriod: {
    totalGenerations: number;
    totalCostUsd: number;
  };
}

export interface ProviderBreakdown {
  provider: string;
  count: number;
  costUsd: number;
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  count: number;
  costUsd: number;
}

export interface DailyTimelinePoint {
  date: string;
  generations: number;
  costUsd: number;
}

export interface AllTimeSummary {
  totalGenerations: number;
  totalCostUsd: number;
  totalApiCalls: number;
  firstGenerationDate: string | null;
}

export interface ReportData {
  summary: ReportSummary;
  allTime: AllTimeSummary;
  byProvider: ProviderBreakdown[];
  byModel: ModelBreakdown[];
  timeline: DailyTimelinePoint[];
  recentCalls: DbApiCall[];
}

// ─── Gallery API Response ────────────────────────────────────────

export interface GenerationListResponse {
  generations: DbGeneration[];
  total: number;
  hasMore: boolean;
}
