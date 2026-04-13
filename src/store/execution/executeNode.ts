/**
 * Central node dispatcher.
 *
 * MIGRATED (Phase 2B-4): dispatch is now registry-driven.
 * The previous 30-case switch is replaced by:
 *   1. nodeSpecRegistry.getSpec(type) → get the spec
 *   2. nodeSpecRegistry.getExecutor(spec.executor) → get the function
 *   3. await fn(ctx) → execute
 *
 * The only remaining special-case logic:
 *   - audioInput / videoInput: check for upstream connections before executing
 *   - API-calling nodes: post-execution cost logging to the DB
 *   - Error logging: caught and re-thrown with DB logging for API nodes
 *
 * Adding a new node = register executor in registerExecutors.ts. Zero changes here.
 */

import { nodeSpecRegistry, registerAllNodeSpecs } from "@/lib/nodes";
import { registerAllExecutors } from "./registerExecutors";
import type { NodeExecutionContext } from "./types";

// Ensure both specs and executors are registered before first dispatch
registerAllNodeSpecs();
registerAllExecutors();

export interface ExecuteNodeOptions {
  /** When true, executors that support it will fall back to stored inputs. */
  useStoredFallback?: boolean;
}

// ─── API call logging ────────────────────────────────────────────────────────

/**
 * Non-blocking helper to log node execution to the database.
 * Failures are logged to console but don't throw.
 */
async function logNodeToDb(
  nodeType: string,
  provider: string,
  model: string,
  costUsd: number,
  durationMs: number,
  status: "success" | "error",
  callType: string = "generation",
  errorMessage?: string,
): Promise<void> {
  try {
    await fetch("/api/db/api-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "admin",
        callType,
        provider,
        model,
        costUsd,
        durationMs,
        status,
        errorMessage,
      }),
    });
  } catch (err) {
    console.warn("[DB] Failed to log API call:", err);
  }
}

// API-calling node types and their logging metadata
const API_NODE_META: Record<string, { defaultProvider: string; defaultModel: string; estimatedCost: number; callType: string }> = {
  nanoBanana:     { defaultProvider: "nano-banana", defaultModel: "nano-banana",     estimatedCost: 0.039, callType: "generation" },
  generateVideo:  { defaultProvider: "veo",         defaultModel: "veo-3.1",          estimatedCost: 0.5,   callType: "generation" },
  generate3d:     { defaultProvider: "kie",         defaultModel: "kie-3d",           estimatedCost: 0.1,   callType: "generation" },
  llmGenerate:    { defaultProvider: "gemini",      defaultModel: "gemini-3-flash-preview", estimatedCost: 0.01, callType: "llm_analysis" },
  generateAudio:  { defaultProvider: "wavespeed",   defaultModel: "wavespeed-audio",  estimatedCost: 0.05,  callType: "generation" },
};

// ─── Inline execution handlers ────────────────────────────────────────────────
// Two nodes need special inline handling that cannot be cleanly expressed
// as pure executor functions (they inspect upstream connections before executing).

async function executeAudioInputInline(ctx: NodeExecutionContext): Promise<void> {
  const audioInputs = ctx.getConnectedInputs(ctx.node.id) as { audio?: string[] };
  if (audioInputs.audio && audioInputs.audio.length > 0 && audioInputs.audio[0]) {
    ctx.updateNodeData(ctx.node.id, { audioFile: audioInputs.audio[0] });
  }
}

async function executeVideoInputInline(ctx: NodeExecutionContext): Promise<void> {
  const videoInputs = ctx.getConnectedInputs(ctx.node.id) as { videos?: string[] };
  if (videoInputs.videos && videoInputs.videos.length > 0 && videoInputs.videos[0]) {
    ctx.updateNodeData(ctx.node.id, { video: videoInputs.videos[0] });
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Execute a single node by dispatching to the appropriate executor.
 *
 * Data-source nodes (`imageInput`) are no-ops.
 * Audio/video inputs may absorb upstream data before deferring to their executor.
 * API-calling nodes log cost to the database after execution.
 */
export async function executeNode(
  ctx: NodeExecutionContext,
  options?: ExecuteNodeOptions,
): Promise<void> {
  const nodeType = ctx.node.type;
  const startTime = Date.now();

  try {
    // ── Special inline nodes ─────────────────────────────────────────────
    if (nodeType === "imageInput") {
      return; // Pure data source — no execution needed
    }
    if (nodeType === "audioInput") {
      return await executeAudioInputInline(ctx);
    }
    if (nodeType === "videoInput") {
      return await executeVideoInputInline(ctx);
    }

    // ── Registry dispatch ────────────────────────────────────────────────
    const spec = nodeSpecRegistry.getSpec(nodeType ?? "");
    if (!spec) {
      console.warn(`[executeNode] No spec registered for node type "${nodeType}". Skipping execution.`);
      return;
    }

    const executorName = spec.executor;

    // __passthrough__ and __noop__ are sentinel names — skip execution
    if (executorName === "__passthrough__" || executorName === "__noop__") {
      return;
    }

    const executorFn = nodeSpecRegistry.getExecutor(executorName);
    if (!executorFn) {
      console.warn(`[executeNode] No executor registered for "${executorName}" (node type: "${nodeType}"). Skipping.`);
      return;
    }

    // Pass useStoredFallback for executors that support it
    const execOptions = options?.useStoredFallback ? { useStoredFallback: true } : undefined;
    await (executorFn as unknown as (ctx: NodeExecutionContext, opts?: Record<string, unknown>) => Promise<void>)(ctx, execOptions);

    // ── Post-execution logging for API-calling nodes ──────────────────
    const meta = API_NODE_META[nodeType];
    if (meta) {
      const provider = String((ctx.node.data as Record<string, unknown>)?.provider || meta.defaultProvider);
      const model    = String((ctx.node.data as Record<string, unknown>)?.model    || meta.defaultModel);
      const durationMs = Date.now() - startTime;
      logNodeToDb(nodeType, provider, model, meta.estimatedCost, durationMs, "success", meta.callType).catch(() => {});
    }
  } catch (err) {
    // Log error for API-calling nodes
    const meta = API_NODE_META[nodeType ?? ""];
    if (meta) {
      const provider = String((ctx.node.data as Record<string, unknown>)?.provider || meta.defaultProvider);
      const model    = String((ctx.node.data as Record<string, unknown>)?.model    || meta.defaultModel);
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      logNodeToDb(nodeType, provider, model, 0, durationMs, "error", meta.callType, errorMessage).catch(() => {});
    }
    throw err;
  }
}
