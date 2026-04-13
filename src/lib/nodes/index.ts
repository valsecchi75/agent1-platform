/**
 * Node library public API.
 *
 * Import from here throughout the codebase:
 *   import { nodeSpecRegistry, registerAllNodeSpecs } from "@/lib/nodes";
 */

export { nodeSpecRegistry } from "./nodeRegistry";
export { registerAllNodeSpecs, ALL_SPECS, getRegisteredSpecCount } from "./allNodeSpecs";
export type { NodeSpec, OutputHandleSpec, InputHandleSpec, HandleDataType, NodeCategory, ConnectionRules, ExecutorFn } from "./nodeSpec";
