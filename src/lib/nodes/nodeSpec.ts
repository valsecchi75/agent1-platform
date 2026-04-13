/**
 * NodeSpec — Schema-driven node type definitions.
 *
 * Each node type registers exactly one NodeSpec. All hardcoded switch statements
 * and if-else chains that previously scattered node knowledge across 5+ files
 * are replaced by a single spec lookup.
 *
 * ADDING A NEW NODE:
 *   1. Add a spec file in custom_nodes/{packId}/specs/ (or define inline here)
 *   2. Register an executor with nodeSpecRegistry.registerExecutor(name, fn)
 *   Zero changes required to any existing core files.
 */

// ─── Data Types ───────────────────────────────────────────────────────────────

/** All handle data types supported by the workflow editor. */
export type HandleDataType = "image" | "text" | "audio" | "video" | "3d" | "easeCurve";

/** Node functional categories (used for UI grouping and search). */
export type NodeCategory =
  | "input"
  | "generation"
  | "processing"
  | "output"
  | "logic"
  | "utility";

// ─── Handle Definitions ──────────────────────────────────────────────────────

/** Describes a single output handle on a node. */
export interface OutputHandleSpec {
  /** Handle ID as rendered in ReactFlow (e.g. "image", "text", "description"). */
  handleId: string;
  /** Data type produced by this handle. */
  dataType: HandleDataType;
  /**
   * Dot-path in the node's data object where the output value lives.
   * Used by getSourceOutput to extract the value without a switch statement.
   *
   * Example: "outputImage" → node.data.outputImage
   *          "outputVideo" → node.data.outputVideo
   *
   * For nodes with conditional extraction (e.g. morpheusModelManagement),
   * set extractFrom to the primary output and handle overrides in the executor.
   */
  extractFrom: string;
  /**
   * If true, this output handle is used as passthrough — the node relays
   * upstream data to downstream nodes without transforming it
   * (applies to router, switch, conditionalSwitch).
   */
  passthrough?: boolean;
}

/** Describes a single input handle on a node. */
export interface InputHandleSpec {
  /** Handle ID as rendered in ReactFlow. */
  handleId: string;
  /** Data type accepted by this input. */
  dataType: HandleDataType;
  /** Whether this handle accepts multiple connections (e.g. image arrays). */
  multiple: boolean;
  /** Whether this input is optional (missing data is not a workflow error). */
  optional?: boolean;
}

// ─── Connection Rules ────────────────────────────────────────────────────────

/**
 * Optional custom connection rules.
 * When absent, standard type-matching applies (source.dataType === target.dataType).
 */
export interface ConnectionRules {
  /**
   * Target node types that a source handle is allowed to connect to.
   * Applied when this spec describes the source node.
   * Replaces the "video can only connect to generateVideo, videoStitch, …" checks.
   */
  allowedTargetNodeTypes?: string[];
  /**
   * Whether this node accepts any source type (used for router, switch).
   */
  acceptsAnySourceType?: boolean;
  /**
   * For passthrough nodes (router, switch): the output handle type is determined
   * at runtime by the upstream connection type, not by a static spec.
   */
  dynamicOutputType?: boolean;
}

// ─── NodeSpec ────────────────────────────────────────────────────────────────

/**
 * Complete specification for a single node type.
 * Replaces:
 *   - createDefaultNodeData switch (via defaultData + defaultDimensions)
 *   - getSourceOutput if-else (via outputs[].extractFrom)
 *   - isValidConnection hardcoding (via inputs/outputs + connectionRules)
 *   - executeNode switch (via executor name)
 */
export interface NodeSpec {
  /** Unique type string — must match ReactFlow node.type and NodeType in types/index.ts */
  type: string;

  /** Human-readable display name shown in the UI. */
  displayName: string;

  /** Functional category for grouping and search. */
  category: NodeCategory;

  /**
   * Default data object created when a new node of this type is added.
   * Replaces one case in createDefaultNodeData().
   *
   * NOTE: For nodes that read from localStorage (nanoBanana, generateVideo, etc.),
   * the defaultData here is the static fallback. The createDefaultNodeData function
   * wraps the registry lookup with the localStorage merge logic.
   */
  defaultData: Record<string, unknown>;

  /** Default width/height for the node in pixels. */
  defaultDimensions: { width: number; height: number };

  /** Output handles — what this node produces. */
  outputs: OutputHandleSpec[];

  /** Input handles — what this node consumes. */
  inputs: InputHandleSpec[];

  /**
   * Optional extra connection rules.
   * When absent, standard sourceType === targetType matching applies.
   */
  connectionRules?: ConnectionRules;

  /**
   * Name of the registered executor function.
   * Looked up in the executor registry at dispatch time.
   * Use "__passthrough__" for nodes that need no execution (imageInput, etc.)
   * Use "__noop__" for display-only nodes (previewImage, showAnything).
   */
  executor: string;

  /** Minimap color for this node type. */
  minimapColor?: string;

  /** Whether this is a core foundation node (prevents uninstall). */
  isCore: boolean;

  /**
   * Pack ID this node belongs to. Matches custom_nodes/{packId} directory.
   * Used for grouping in the node picker and registry management.
   */
  packId?: string;
}

// ─── Executor Types ──────────────────────────────────────────────────────────

/** Context provided to every executor function (mirrors NodeExecutionContext). */
export interface ExecutorContext {
  node: {
    id: string;
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  };
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  getConnectedInputs: (nodeId: string) => unknown;
  [key: string]: unknown;
}

/** Signature for all executor functions. */
export type ExecutorFn = (ctx: ExecutorContext, options?: Record<string, unknown>) => Promise<void>;
