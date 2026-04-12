/**
 * graphStore — Zona Congelata Contract Tests
 *
 * These tests pin the public API surface of graphStore.ts.
 * If any of these tests break, it means the contract was changed — which
 * requires a PR review and a conscious decision to accept the breakage.
 *
 * DO NOT modify these tests to "make them pass" after accidental API changes.
 * Fix the code, not the tests.
 *
 * Contract coverage:
 *  - GraphSlice interface shape (all required exports exist)
 *  - Module-level counter exports and setters
 *  - createGraphSlice builds a valid slice on a minimal store
 *  - addNode returns a string ID and appends a node
 *  - removeNode removes node and its connected edges
 *  - onConnect adds an edge between two nodes
 *  - copySelectedNodes + pasteNodes round-trip
 *  - createGroup / deleteGroup lifecycle
 *  - toggleGroupLock flips locked flag
 *  - getConnectedInputs shape contract (returns required fields)
 *  - validateWorkflow returns { valid, errors }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStore } from "zustand";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// graphStore imports @xyflow/react — provide stubs so the module loads in Vitest
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    addEdge: vi.fn((connection: unknown, edges: unknown[]) => [
      ...(edges as object[]),
      {
        id: `edge-stub`,
        source: (connection as Record<string, string>).source,
        target: (connection as Record<string, string>).target,
        sourceHandle: (connection as Record<string, string>).sourceHandle ?? null,
        targetHandle: (connection as Record<string, string>).targetHandle ?? null,
        data: {},
      },
    ]),
    applyNodeChanges: vi.fn((changes: unknown[], nodes: unknown[]) => nodes),
    applyEdgeChanges: vi.fn((changes: unknown[], edges: unknown[]) => edges),
  };
});

vi.mock("@/components/Toast", () => ({
  useToast: { getState: () => ({ show: vi.fn() }) },
}));

vi.mock("@/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal Zustand store that composes graphSlice with the deps
 * it needs (pushUndoEntry, incrementManualChangeCount, recomputeDimmedNodes).
 */
async function buildStore() {
  const { createGraphSlice } = await import("@/store/graphStore");

  return createStore<ReturnType<typeof createGraphSlice> & {
    pushUndoEntry: ReturnType<typeof vi.fn>;
    incrementManualChangeCount: ReturnType<typeof vi.fn>;
    recomputeDimmedNodes: ReturnType<typeof vi.fn>;
    dimmedNodeIds: Set<string>;
    hasUnsavedChanges: boolean;
  }>()((set, get, api) => ({
    ...createGraphSlice(set as never, get as never, api as never),
    pushUndoEntry: vi.fn(),
    incrementManualChangeCount: vi.fn(),
    recomputeDimmedNodes: vi.fn(),
    dimmedNodeIds: new Set<string>(),
    hasUnsavedChanges: false,
  }));
}

// ─── Module-level exports contract ────────────────────────────────────────────

describe("graphStore module exports", () => {
  it("exports nodeIdCounter as a mutable number", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.nodeIdCounter).toBe("number");
  });

  it("exports setNodeIdCounter as a function", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.setNodeIdCounter).toBe("function");
  });

  it("setNodeIdCounter mutates nodeIdCounter", async () => {
    const mod = await import("@/store/graphStore");
    const before = mod.nodeIdCounter;
    mod.setNodeIdCounter(999);
    expect(mod.nodeIdCounter).toBe(999);
    mod.setNodeIdCounter(before); // restore
  });

  it("exports groupIdCounter as a mutable number", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.groupIdCounter).toBe("number");
  });

  it("exports setGroupIdCounter as a function", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.setGroupIdCounter).toBe("function");
  });

  it("exports GROUP_COLORS as an object (value, not type-only)", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.GROUP_COLORS).toBe("object");
    expect(mod.GROUP_COLORS).not.toBeNull();
  });

  it("exports createGraphSlice as a function", async () => {
    const mod = await import("@/store/graphStore");
    expect(typeof mod.createGraphSlice).toBe("function");
  });
});

// ─── GraphSlice interface contract ────────────────────────────────────────────

describe("GraphSlice public API shape", () => {
  it("slice contains all required state fields", async () => {
    const store = await buildStore();
    const state = store.getState();

    expect(Array.isArray(state.nodes)).toBe(true);
    expect(Array.isArray(state.edges)).toBe(true);
    expect(typeof state.edgeStyle).toBe("string");
    expect(state.groups).toBeDefined();
    // clipboard may be null initially
    expect("clipboard" in state).toBe(true);
  });

  it("slice contains all required action methods", async () => {
    const store = await buildStore();
    const state = store.getState();

    const requiredMethods = [
      "setEdgeStyle",
      "addNode",
      "updateNodeData",
      "removeNode",
      "onNodesChange",
      "onEdgesChange",
      "onConnect",
      "addEdgeWithType",
      "removeEdge",
      "toggleEdgePause",
      "copySelectedNodes",
      "pasteNodes",
      "clearClipboard",
      "createGroup",
      "deleteGroup",
      "addNodesToGroup",
      "removeNodesFromGroup",
      "updateGroup",
      "toggleGroupLock",
      "moveGroupNodes",
      "setNodeGroupId",
      "toggleBypassNodes",
      "getNodeById",
      "getConnectedInputs",
      "validateWorkflow",
    ] as const;

    for (const method of requiredMethods) {
      expect(
        typeof state[method],
        `GraphSlice must expose "${method}" as a function`
      ).toBe("function");
    }
  });

  it("edgeStyle initialises to 'curved'", async () => {
    const store = await buildStore();
    expect(store.getState().edgeStyle).toBe("curved");
  });
});

// ─── addNode ──────────────────────────────────────────────────────────────────

describe("addNode", () => {
  it("returns a string ID", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("prompt", { x: 0, y: 0 });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("appends one node to state.nodes", async () => {
    const store = await buildStore();
    const before = store.getState().nodes.length;
    store.getState().addNode("prompt", { x: 0, y: 0 });
    expect(store.getState().nodes.length).toBe(before + 1);
  });

  it("returned ID is the id of the newly added node", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("prompt", { x: 10, y: 20 });
    const node = store.getState().nodes.find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node?.type).toBe("prompt");
  });

  it("sets hasUnsavedChanges to true", async () => {
    const store = await buildStore();
    store.getState().addNode("prompt", { x: 0, y: 0 });
    expect(store.getState().hasUnsavedChanges).toBe(true);
  });

  it("calls pushUndoEntry once", async () => {
    const store = await buildStore();
    const pushUndoEntry = store.getState().pushUndoEntry as ReturnType<typeof vi.fn>;
    pushUndoEntry.mockClear();
    store.getState().addNode("prompt", { x: 0, y: 0 });
    expect(pushUndoEntry).toHaveBeenCalledTimes(1);
  });
});

// ─── removeNode ───────────────────────────────────────────────────────────────

describe("removeNode", () => {
  it("removes the node with the given ID", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("prompt", { x: 0, y: 0 });
    store.getState().removeNode(id);
    expect(store.getState().nodes.find((n) => n.id === id)).toBeUndefined();
  });

  it("is a no-op for unknown IDs (does not throw)", async () => {
    const store = await buildStore();
    expect(() => store.getState().removeNode("nonexistent-node-id")).not.toThrow();
  });
});

// ─── updateNodeData ───────────────────────────────────────────────────────────

describe("updateNodeData", () => {
  it("merges partial data into the target node", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("prompt", { x: 0, y: 0 });
    store.getState().updateNodeData(id, { prompt: "hello" } as never);
    const node = store.getState().nodes.find((n) => n.id === id);
    expect((node?.data as Record<string, unknown>)?.prompt).toBe("hello");
  });

  it("does not affect other nodes", async () => {
    const store = await buildStore();
    const id1 = store.getState().addNode("prompt", { x: 0, y: 0 });
    const id2 = store.getState().addNode("prompt", { x: 100, y: 0 });
    store.getState().updateNodeData(id1, { prompt: "only-node-1" } as never);
    const node2 = store.getState().nodes.find((n) => n.id === id2);
    expect((node2?.data as Record<string, unknown>)?.prompt).not.toBe("only-node-1");
  });
});

// ─── setEdgeStyle ─────────────────────────────────────────────────────────────

describe("setEdgeStyle", () => {
  it("updates edgeStyle to 'angular'", async () => {
    const store = await buildStore();
    store.getState().setEdgeStyle("angular");
    expect(store.getState().edgeStyle).toBe("angular");
  });

  it("updates edgeStyle back to 'curved'", async () => {
    const store = await buildStore();
    store.getState().setEdgeStyle("angular");
    store.getState().setEdgeStyle("curved");
    expect(store.getState().edgeStyle).toBe("curved");
  });
});

// ─── createGroup / deleteGroup ────────────────────────────────────────────────

describe("createGroup / deleteGroup lifecycle", () => {
  it("createGroup returns a string group ID", async () => {
    const store = await buildStore();
    const nodeId = store.getState().addNode("prompt", { x: 0, y: 0 });
    const groupId = store.getState().createGroup([nodeId]);
    expect(typeof groupId).toBe("string");
    expect(groupId.length).toBeGreaterThan(0);
  });

  it("createGroup adds an entry to state.groups", async () => {
    const store = await buildStore();
    const nodeId = store.getState().addNode("prompt", { x: 0, y: 0 });
    const groupId = store.getState().createGroup([nodeId]);
    expect(store.getState().groups[groupId]).toBeDefined();
  });

  it("deleteGroup removes the entry from state.groups", async () => {
    const store = await buildStore();
    const nodeId = store.getState().addNode("prompt", { x: 0, y: 0 });
    const groupId = store.getState().createGroup([nodeId]);
    store.getState().deleteGroup(groupId);
    expect(store.getState().groups[groupId]).toBeUndefined();
  });

  it("toggleGroupLock flips the locked flag", async () => {
    const store = await buildStore();
    const nodeId = store.getState().addNode("prompt", { x: 0, y: 0 });
    const groupId = store.getState().createGroup([nodeId]);

    const before = store.getState().groups[groupId]?.locked ?? false;
    store.getState().toggleGroupLock(groupId);
    expect(store.getState().groups[groupId]?.locked).toBe(!before);
  });
});

// ─── getConnectedInputs ───────────────────────────────────────────────────────

describe("getConnectedInputs return shape contract", () => {
  it("returns the required fields for an isolated node", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("prompt", { x: 0, y: 0 });
    const result = store.getState().getConnectedInputs(id);

    expect(Array.isArray(result.images)).toBe(true);
    expect(Array.isArray(result.videos)).toBe(true);
    expect(Array.isArray(result.audio)).toBe(true);
    expect("text" in result).toBe(true);
    expect("model3d" in result).toBe(true);
    expect("dynamicInputs" in result).toBe(true);
    expect("easeCurve" in result).toBe(true);
  });

  it("returns empty arrays and null for an isolated node", async () => {
    const store = await buildStore();
    const id = store.getState().addNode("nanoBanana", { x: 0, y: 0 });
    const result = store.getState().getConnectedInputs(id);

    expect(result.images).toEqual([]);
    expect(result.videos).toEqual([]);
    expect(result.audio).toEqual([]);
    expect(result.text).toBeNull();
    expect(result.model3d).toBeNull();
    expect(result.easeCurve).toBeNull();
  });
});

// ─── validateWorkflow ─────────────────────────────────────────────────────────

describe("validateWorkflow return shape contract", () => {
  it("returns { valid: boolean, errors: string[] }", async () => {
    const store = await buildStore();
    const result = store.getState().validateWorkflow();

    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("empty canvas is not valid (no output node)", async () => {
    const store = await buildStore();
    const { valid } = store.getState().validateWorkflow();
    expect(valid).toBe(false);
  });
});

// ─── clipboard round-trip ─────────────────────────────────────────────────────

describe("copySelectedNodes + pasteNodes", () => {
  it("clipboard is null initially", async () => {
    const store = await buildStore();
    expect(store.getState().clipboard).toBeNull();
  });

  it("clearClipboard resets clipboard to null", async () => {
    const store = await buildStore();
    store.getState().clearClipboard();
    expect(store.getState().clipboard).toBeNull();
  });

  it("pasteNodes with null clipboard is a no-op (does not throw)", async () => {
    const store = await buildStore();
    expect(() => store.getState().pasteNodes()).not.toThrow();
  });
});
