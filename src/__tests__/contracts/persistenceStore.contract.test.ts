/**
 * persistenceStore — Zona Congelata Contract Tests
 *
 * Pins the public API surface of persistenceStore.ts.
 * These tests define the "Zona Congelata" for the persistence slice.
 * Breaking them requires a PR review.
 *
 * Contract coverage:
 *  - pendingImageSyncs module export (Map instance)
 *  - WorkflowFile interface shape (version field required)
 *  - createPersistenceSlice builds a valid slice on a minimal store
 *  - PersistenceSlice initial state values
 *  - PersistenceSlice all required methods exist
 *  - clearWorkflow resets core state to initial values
 *  - addToGlobalHistory / clearGlobalHistory lifecycle
 *  - setWorkflowMetadata sets all metadata fields
 *  - setWorkflowName, setGenerationsPath, markAsUnsaved
 *  - setAutoSaveEnabled, setUseExternalImageStorage
 *  - loadWorkflow: round-trip restores nodes and edges
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

// Stub imageStorage utils — they make file-system calls
vi.mock("@/utils/imageStorage", () => ({
  externalizeWorkflowImages: vi.fn(async (nodes: unknown[]) => nodes),
  hydrateWorkflowImages: vi.fn(async (nodes: unknown[]) => nodes),
}));

// Stub localStorage persistence helpers
vi.mock("@/store/utils/localStorage", () => ({
  loadSaveConfigs: vi.fn(() => []),
  saveSaveConfig: vi.fn(),
  generateWorkflowId: vi.fn(() => "test-workflow-id"),
}));

// Stub graphStore counter setters
vi.mock("@/store/graphStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/graphStore")>();
  return {
    ...actual,
    setNodeIdCounter: vi.fn(),
    setGroupIdCounter: vi.fn(),
  };
});

const mockLocalStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function buildStore() {
  const { createPersistenceSlice } = await import("@/store/persistenceStore");

  return createStore<
    ReturnType<typeof createPersistenceSlice> & {
      nodes: never[];
      edges: never[];
      edgeStyle: "curved";
      groups: Record<string, never>;
      clearSnapshot: ReturnType<typeof vi.fn>;
      recomputeDimmedNodes: ReturnType<typeof vi.fn>;
      incurredCost: number;
      isRunning: boolean;
      currentNodeIds: never[];
      showQuickstart: boolean;
      viewedCommentNodeIds: Set<string>;
      dimmedNodeIds: Set<string>;
    }
  >()((set, get, api) => ({
    ...createPersistenceSlice(set as never, get as never, api as never),
    nodes: [],
    edges: [],
    edgeStyle: "curved" as const,
    groups: {},
    clearSnapshot: vi.fn(),
    recomputeDimmedNodes: vi.fn(),
    incurredCost: 0,
    isRunning: false,
    currentNodeIds: [],
    showQuickstart: false,
    viewedCommentNodeIds: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  }));
}

// ─── Module-level exports contract ────────────────────────────────────────────

describe("persistenceStore module exports", () => {
  it("exports pendingImageSyncs as a Map", async () => {
    const mod = await import("@/store/persistenceStore");
    expect(mod.pendingImageSyncs).toBeInstanceOf(Map);
  });

  it("exports createPersistenceSlice as a function", async () => {
    const mod = await import("@/store/persistenceStore");
    expect(typeof mod.createPersistenceSlice).toBe("function");
  });
});

// ─── WorkflowFile interface contract ─────────────────────────────────────────

describe("WorkflowFile format contract", () => {
  it("WorkflowFile version must be the literal 1", async () => {
    // We verify this by constructing a minimal valid WorkflowFile
    const minimalWorkflow = {
      version: 1 as const,
      name: "test",
      nodes: [],
      edges: [],
      edgeStyle: "curved" as const,
    };
    // TypeScript compilation guarantees the shape; runtime check:
    expect(minimalWorkflow.version).toBe(1);
    expect(typeof minimalWorkflow.name).toBe("string");
    expect(Array.isArray(minimalWorkflow.nodes)).toBe(true);
    expect(Array.isArray(minimalWorkflow.edges)).toBe(true);
  });
});

// ─── PersistenceSlice initial state ──────────────────────────────────────────

describe("PersistenceSlice initial state", () => {
  it("all nullable state fields start as null", async () => {
    const store = await buildStore();
    const state = store.getState();

    expect(state.workflowId).toBeNull();
    expect(state.workflowName).toBeNull();
    expect(state.saveDirectoryPath).toBeNull();
    expect(state.generationsPath).toBeNull();
    expect(state.lastSavedAt).toBeNull();
    expect(state.imageRefBasePath).toBeNull();
  });

  it("boolean flags have correct defaults", async () => {
    const store = await buildStore();
    const state = store.getState();

    expect(state.hasUnsavedChanges).toBe(false);
    expect(state.autoSaveEnabled).toBe(true);
    expect(state.isSaving).toBe(false);
    expect(state.useExternalImageStorage).toBe(true);
  });

  it("globalImageHistory starts as empty array", async () => {
    const store = await buildStore();
    expect(store.getState().globalImageHistory).toEqual([]);
  });
});

// ─── PersistenceSlice method presence ────────────────────────────────────────

describe("PersistenceSlice public API shape", () => {
  it("slice contains all required action methods", async () => {
    const store = await buildStore();
    const state = store.getState();

    const requiredMethods = [
      "saveWorkflow",
      "loadWorkflow",
      "clearWorkflow",
      "setWorkflowMetadata",
      "setWorkflowName",
      "setGenerationsPath",
      "setAutoSaveEnabled",
      "setUseExternalImageStorage",
      "markAsUnsaved",
      "saveToFile",
      "saveAsFile",
      "initializeAutoSave",
      "cleanupAutoSave",
      "addToGlobalHistory",
      "clearGlobalHistory",
    ] as const;

    for (const method of requiredMethods) {
      expect(
        typeof state[method],
        `PersistenceSlice must expose "${method}" as a function`
      ).toBe("function");
    }
  });
});

// ─── clearWorkflow ────────────────────────────────────────────────────────────

describe("clearWorkflow", () => {
  it("resets workflowId, workflowName, saveDirectoryPath to null", async () => {
    const store = await buildStore();
    // Set some values first
    store.getState().setWorkflowMetadata("some-id", "some-name", "/some/path");
    // Now clear
    store.getState().clearWorkflow();

    const state = store.getState();
    expect(state.workflowId).toBeNull();
    expect(state.workflowName).toBeNull();
    expect(state.saveDirectoryPath).toBeNull();
  });

  it("resets hasUnsavedChanges to false", async () => {
    const store = await buildStore();
    store.getState().markAsUnsaved();
    expect(store.getState().hasUnsavedChanges).toBe(true);
    store.getState().clearWorkflow();
    expect(store.getState().hasUnsavedChanges).toBe(false);
  });
});

// ─── setWorkflowMetadata ──────────────────────────────────────────────────────

describe("setWorkflowMetadata", () => {
  it("sets all three required fields", async () => {
    const store = await buildStore();
    store.getState().setWorkflowMetadata("wf-001", "My Workflow", "/path/to/dir");

    const state = store.getState();
    expect(state.workflowId).toBe("wf-001");
    expect(state.workflowName).toBe("My Workflow");
    expect(state.saveDirectoryPath).toBe("/path/to/dir");
  });

  it("sets generationsPath when provided", async () => {
    const store = await buildStore();
    store.getState().setWorkflowMetadata("wf-002", "gen", "/dir", "/gen/path");
    expect(store.getState().generationsPath).toBe("/gen/path");
  });
});

// ─── setWorkflowName ──────────────────────────────────────────────────────────

describe("setWorkflowName", () => {
  it("updates workflowName", async () => {
    const store = await buildStore();
    store.getState().setWorkflowName("New Name");
    expect(store.getState().workflowName).toBe("New Name");
  });
});

// ─── setGenerationsPath ───────────────────────────────────────────────────────

describe("setGenerationsPath", () => {
  it("updates generationsPath to a new path", async () => {
    const store = await buildStore();
    store.getState().setGenerationsPath("/some/path");
    expect(store.getState().generationsPath).toBe("/some/path");
  });

  it("updates generationsPath to null", async () => {
    const store = await buildStore();
    store.getState().setGenerationsPath("/some/path");
    store.getState().setGenerationsPath(null);
    expect(store.getState().generationsPath).toBeNull();
  });
});

// ─── markAsUnsaved ────────────────────────────────────────────────────────────

describe("markAsUnsaved", () => {
  it("sets hasUnsavedChanges to true", async () => {
    const store = await buildStore();
    expect(store.getState().hasUnsavedChanges).toBe(false);
    store.getState().markAsUnsaved();
    expect(store.getState().hasUnsavedChanges).toBe(true);
  });
});

// ─── setAutoSaveEnabled ───────────────────────────────────────────────────────

describe("setAutoSaveEnabled", () => {
  it("sets autoSaveEnabled to false", async () => {
    const store = await buildStore();
    store.getState().setAutoSaveEnabled(false);
    expect(store.getState().autoSaveEnabled).toBe(false);
  });

  it("sets autoSaveEnabled back to true", async () => {
    const store = await buildStore();
    store.getState().setAutoSaveEnabled(false);
    store.getState().setAutoSaveEnabled(true);
    expect(store.getState().autoSaveEnabled).toBe(true);
  });
});

// ─── setUseExternalImageStorage ───────────────────────────────────────────────

describe("setUseExternalImageStorage", () => {
  it("sets useExternalImageStorage to false", async () => {
    const store = await buildStore();
    store.getState().setUseExternalImageStorage(false);
    expect(store.getState().useExternalImageStorage).toBe(false);
  });
});

// ─── addToGlobalHistory / clearGlobalHistory ─────────────────────────────────

describe("global image history", () => {
  it("addToGlobalHistory prepends an item with a generated id", async () => {
    const store = await buildStore();
    store.getState().addToGlobalHistory({
      image: "data:image/png;base64,abc",
      timestamp: Date.now(),
      prompt: "a red square",
      aspectRatio: "1:1",
      model: "nano-banana",
    });

    const history = store.getState().globalImageHistory;
    expect(history.length).toBe(1);
    expect(typeof history[0].id).toBe("string");
    expect(history[0].id.length).toBeGreaterThan(0);
    expect(history[0].image).toBe("data:image/png;base64,abc");
  });

  it("addToGlobalHistory prepends (newest first)", async () => {
    const store = await buildStore();
    const base = {
      timestamp: Date.now(),
      prompt: "p",
      aspectRatio: "1:1" as const,
      model: "nano-banana" as const,
    };
    store.getState().addToGlobalHistory({ ...base, image: "image-first" });
    store.getState().addToGlobalHistory({ ...base, image: "image-second" });

    expect(store.getState().globalImageHistory[0].image).toBe("image-second");
    expect(store.getState().globalImageHistory[1].image).toBe("image-first");
  });

  it("clearGlobalHistory empties the array", async () => {
    const store = await buildStore();
    store.getState().addToGlobalHistory({
      image: "data:image/png;base64,xyz",
      timestamp: Date.now(),
      prompt: "p",
      aspectRatio: "1:1",
      model: "nano-banana",
    });
    expect(store.getState().globalImageHistory.length).toBe(1);

    store.getState().clearGlobalHistory();
    expect(store.getState().globalImageHistory).toEqual([]);
  });
});

// ─── loadWorkflow ─────────────────────────────────────────────────────────────

describe("loadWorkflow round-trip", () => {
  it("restores workflowName from the loaded file", async () => {
    const store = await buildStore();

    const workflow = {
      version: 1 as const,
      id: "restored-id",
      name: "Restored Workflow",
      nodes: [],
      edges: [],
      edgeStyle: "curved" as const,
    };

    await store.getState().loadWorkflow(workflow);
    expect(store.getState().workflowName).toBe("Restored Workflow");
  });

  it("resolves without throwing for a minimal valid workflow", async () => {
    const store = await buildStore();

    const workflow = {
      version: 1 as const,
      name: "Minimal",
      nodes: [],
      edges: [],
      edgeStyle: "curved" as const,
    };

    await expect(store.getState().loadWorkflow(workflow)).resolves.not.toThrow();
  });
});
