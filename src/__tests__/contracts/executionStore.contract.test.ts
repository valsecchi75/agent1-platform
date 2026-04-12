/**
 * executionStore — Zona Congelata Contract Tests
 *
 * Pins the public API surface of executionStore.ts.
 * These tests define the "Zona Congelata" for the execution slice.
 * Breaking them requires a PR review.
 *
 * Contract coverage:
 *  - CONCURRENCY_SETTINGS_KEY export (string constant)
 *  - createExecutionSlice builds a valid slice on a minimal store
 *  - ExecutionSlice interface shape (all required state fields + methods)
 *  - Initial state values
 *  - stopWorkflow sets isRunning=false when not running (idempotent)
 *  - setMaxConcurrentCalls updates maxConcurrentCalls
 *  - executeWorkflow with empty graph completes without throwing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStore } from "zustand";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/Toast", () => ({
  useToast: { getState: () => ({ show: vi.fn() }) },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    startSession: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    getCurrentSession: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("@/store/execution/executeNode", () => ({
  executeNode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual };
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Zustand store composing executionSlice + minimal deps stubs.
 */
async function buildStore() {
  const { createExecutionSlice } = await import("@/store/executionStore");

  const providerSettings = {
    providers: {
      gemini: { apiKey: "", enabled: true },
    },
  };

  return createStore<
    ReturnType<typeof createExecutionSlice> & {
      nodes: never[];
      edges: never[];
      groups: Record<string, never>;
      getConnectedInputs: ReturnType<typeof vi.fn>;
      updateNodeData: ReturnType<typeof vi.fn>;
      dimmedNodeIds: Set<string>;
      generationsPath: null;
      saveDirectoryPath: null;
      workflowId: null;
      workflowName: null;
      addToGlobalHistory: ReturnType<typeof vi.fn>;
      addIncurredCost: ReturnType<typeof vi.fn>;
      providerSettings: typeof providerSettings;
    }
  >()((set, get, api) => ({
    ...createExecutionSlice(set as never, get as never, api as never),
    nodes: [],
    edges: [],
    groups: {},
    getConnectedInputs: vi.fn().mockReturnValue({
      images: [],
      videos: [],
      audio: [],
      model3d: null,
      text: null,
      dynamicInputs: {},
      easeCurve: null,
    }),
    updateNodeData: vi.fn(),
    dimmedNodeIds: new Set<string>(),
    generationsPath: null,
    saveDirectoryPath: null,
    workflowId: null,
    workflowName: null,
    addToGlobalHistory: vi.fn(),
    addIncurredCost: vi.fn(),
    providerSettings,
  }));
}

// ─── Module-level exports contract ────────────────────────────────────────────

describe("executionStore module exports", () => {
  it("exports CONCURRENCY_SETTINGS_KEY as a non-empty string", async () => {
    const { CONCURRENCY_SETTINGS_KEY } = await import("@/store/executionStore");
    expect(typeof CONCURRENCY_SETTINGS_KEY).toBe("string");
    expect(CONCURRENCY_SETTINGS_KEY.length).toBeGreaterThan(0);
  });

  it("exports createExecutionSlice as a function", async () => {
    const { createExecutionSlice } = await import("@/store/executionStore");
    expect(typeof createExecutionSlice).toBe("function");
  });
});

// ─── ExecutionSlice interface contract ────────────────────────────────────────

describe("ExecutionSlice public API shape", () => {
  it("slice contains all required state fields with correct initial values", async () => {
    const store = await buildStore();
    const state = store.getState();

    expect(state.isRunning).toBe(false);
    expect(Array.isArray(state.currentNodeIds)).toBe(true);
    expect(state.currentNodeIds).toEqual([]);
    expect(state.pausedAtNodeId).toBeNull();
    expect(typeof state.maxConcurrentCalls).toBe("number");
    expect(state.maxConcurrentCalls).toBeGreaterThanOrEqual(1);
    // _abortController starts null
    expect(state._abortController).toBeNull();
  });

  it("slice contains all required action methods", async () => {
    const store = await buildStore();
    const state = store.getState();

    const requiredMethods = [
      "_buildExecutionContext",
      "executeWorkflow",
      "regenerateNode",
      "executeSelectedNodes",
      "stopWorkflow",
      "setMaxConcurrentCalls",
    ] as const;

    for (const method of requiredMethods) {
      expect(
        typeof state[method],
        `ExecutionSlice must expose "${method}" as a function`
      ).toBe("function");
    }
  });
});

// ─── stopWorkflow ─────────────────────────────────────────────────────────────

describe("stopWorkflow", () => {
  it("is idempotent — calling when not running does not throw", async () => {
    const store = await buildStore();
    expect(store.getState().isRunning).toBe(false);
    expect(() => store.getState().stopWorkflow()).not.toThrow();
    expect(store.getState().isRunning).toBe(false);
  });
});

// ─── setMaxConcurrentCalls ────────────────────────────────────────────────────

describe("setMaxConcurrentCalls", () => {
  it("updates maxConcurrentCalls", async () => {
    const store = await buildStore();
    store.getState().setMaxConcurrentCalls(3);
    expect(store.getState().maxConcurrentCalls).toBe(3);
  });

  it("accepts 1 (minimum concurrency)", async () => {
    const store = await buildStore();
    store.getState().setMaxConcurrentCalls(1);
    expect(store.getState().maxConcurrentCalls).toBe(1);
  });
});

// ─── executeWorkflow — empty graph ────────────────────────────────────────────

describe("executeWorkflow on empty graph", () => {
  it("resolves without throwing when there are no nodes", async () => {
    const store = await buildStore();
    expect(store.getState().nodes).toEqual([]);
    await expect(store.getState().executeWorkflow()).resolves.not.toThrow();
  });

  it("isRunning returns to false after empty-graph execution", async () => {
    const store = await buildStore();
    await store.getState().executeWorkflow();
    expect(store.getState().isRunning).toBe(false);
  });
});

// ─── _buildExecutionContext ───────────────────────────────────────────────────

describe("_buildExecutionContext", () => {
  it("returns an object with required NodeExecutionContext fields", async () => {
    const store = await buildStore();
    const mockNode = {
      id: "test-node",
      type: "prompt" as const,
      position: { x: 0, y: 0 },
      data: { prompt: "" } as never,
    };

    const ctx = store.getState()._buildExecutionContext(mockNode);

    expect(ctx.node).toBe(mockNode);
    expect(typeof ctx.updateNodeData).toBe("function");
    expect(typeof ctx.getConnectedInputs).toBe("function");
    expect(typeof ctx.getFreshNode).toBe("function");
    expect(typeof ctx.getEdges).toBe("function");
    expect(typeof ctx.getNodes).toBe("function");
    expect(typeof ctx.addIncurredCost).toBe("function");
    expect(typeof ctx.addToGlobalHistory).toBe("function");
    expect(typeof ctx.trackSaveGeneration).toBe("function");
    expect(ctx.providerSettings).toBeDefined();
  });
});
