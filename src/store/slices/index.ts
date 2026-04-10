/**
 * Store Slices — barrel export
 *
 * Each slice encapsulates a self-contained domain of state + actions,
 * extracted from the monolithic workflowStore for maintainability.
 */

export { createUISlice } from "./uiSlice";
export type { UISlice } from "./uiSlice";

export { createProviderSlice } from "./providerSlice";
export type { ProviderSlice } from "./providerSlice";

export { createCostSlice } from "./costSlice";
export type { CostSlice, CostSliceDeps } from "./costSlice";

export { createCanvasNavSlice } from "./canvasNavSlice";
export type { CanvasNavSlice } from "./canvasNavSlice";

export { createCommentSlice } from "./commentSlice";
export type { CommentSlice, CommentSliceDeps } from "./commentSlice";

export { createSnapshotSlice } from "./snapshotSlice";
export type { SnapshotSlice, SnapshotSliceDeps } from "./snapshotSlice";

export { createDimmingSlice } from "./dimmingSlice";
export type { DimmingSlice, DimmingSliceDeps } from "./dimmingSlice";

export { createAuthSlice } from "./authSlice";
export type { AuthSlice, CurrentUser } from "./authSlice";
