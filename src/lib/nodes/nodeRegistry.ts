/**
 * NodeSpec Registry
 *
 * Single source of truth for all node type metadata and executor functions.
 *
 * Usage:
 *   import { nodeSpecRegistry } from "@/lib/nodes/nodeRegistry";
 *
 *   // Register (done at startup in allNodeSpecs.ts)
 *   nodeSpecRegistry.register(spec);
 *   nodeSpecRegistry.registerExecutor("executeNanoBanana", executeNanaBanana);
 *
 *   // Consume (in migrations)
 *   const spec = nodeSpecRegistry.getSpec("nanoBanana");
 *   const executor = nodeSpecRegistry.getExecutor(spec.executor);
 */

import type { NodeSpec, ExecutorFn } from "./nodeSpec";

// ─── Registry Class ──────────────────────────────────────────────────────────

class NodeSpecRegistry {
  private specs = new Map<string, NodeSpec>();
  private executors = new Map<string, ExecutorFn>();

  // ── Spec registration ──────────────────────────────────────────────────────

  /**
   * Register a NodeSpec. Overwrites any existing spec for the same type.
   * Called once per node type at module initialization time.
   */
  register(spec: NodeSpec): void {
    this.specs.set(spec.type, spec);
  }

  /**
   * Register multiple specs at once (convenience for pack loaders).
   */
  registerAll(specs: NodeSpec[]): void {
    for (const spec of specs) {
      this.register(spec);
    }
  }

  // ── Spec access ────────────────────────────────────────────────────────────

  /**
   * Returns the spec for a node type, or undefined if not registered.
   */
  getSpec(type: string): NodeSpec | undefined {
    return this.specs.get(type);
  }

  /**
   * Returns all registered specs.
   */
  getAllSpecs(): NodeSpec[] {
    return Array.from(this.specs.values());
  }

  /**
   * Returns all registered node type strings.
   */
  getAllTypes(): string[] {
    return Array.from(this.specs.keys());
  }

  /**
   * Returns true if the given type is registered.
   */
  hasSpec(type: string): boolean {
    return this.specs.has(type);
  }

  // ── Executor registration ──────────────────────────────────────────────────

  /**
   * Register an executor function under a name.
   * The name matches spec.executor in NodeSpec.
   */
  registerExecutor(name: string, fn: ExecutorFn): void {
    this.executors.set(name, fn);
  }

  /**
   * Returns the executor for a given executor name, or undefined if not found.
   */
  getExecutor(name: string): ExecutorFn | undefined {
    return this.executors.get(name);
  }

  /**
   * Returns true if the given executor name is registered.
   */
  hasExecutor(name: string): boolean {
    return this.executors.has(name);
  }

  // ── Derived helpers ────────────────────────────────────────────────────────

  /**
   * Returns the default data for a node type.
   * Returns undefined if the type is not registered.
   */
  getDefaultData(type: string): Record<string, unknown> | undefined {
    return this.specs.get(type)?.defaultData;
  }

  /**
   * Returns the default dimensions for a node type.
   * Returns undefined if the type is not registered.
   */
  getDefaultDimensions(type: string): { width: number; height: number } | undefined {
    return this.specs.get(type)?.defaultDimensions;
  }

  /**
   * Returns the primary output extract path for a node type.
   * Used by getSourceOutput to extract output values.
   */
  getPrimaryOutputExtractFrom(type: string): string | undefined {
    const spec = this.specs.get(type);
    return spec?.outputs?.[0]?.extractFrom;
  }

  /**
   * Returns all registered output specs for a given node type.
   */
  getOutputs(type: string) {
    return this.specs.get(type)?.outputs ?? [];
  }

  /**
   * Returns all registered input specs for a given node type.
   */
  getInputs(type: string) {
    return this.specs.get(type)?.inputs ?? [];
  }

  // ── Debug ──────────────────────────────────────────────────────────────────

  /**
   * Returns a summary of registered specs (for logging/debug).
   */
  getSummary(): { totalSpecs: number; totalExecutors: number; types: string[] } {
    return {
      totalSpecs: this.specs.size,
      totalExecutors: this.executors.size,
      types: this.getAllTypes(),
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * The global NodeSpec registry.
 * Import this anywhere in the codebase to access node metadata.
 */
export const nodeSpecRegistry = new NodeSpecRegistry();

// ─── Re-export types for convenience ─────────────────────────────────────────

export type { NodeSpec, ExecutorFn } from "./nodeSpec";
