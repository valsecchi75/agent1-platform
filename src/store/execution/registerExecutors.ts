/**
 * registerExecutors.ts
 *
 * Registers all executor functions with the NodeSpec registry.
 * Call registerAllExecutors() once at startup (done automatically by executeNode.ts).
 *
 * This is the companion to registerAllNodeSpecs() — specs define WHAT a node is,
 * executors define WHAT it DOES at runtime.
 *
 * Executor name → spec.executor name mapping:
 *   "__passthrough__"  → imageInput (no-op, data source)
 *   "__noop__"         → previewImage, showAnything (display-only)
 *   "executeAudioInput" etc → all others
 */

import { nodeSpecRegistry } from "@/lib/nodes";

// ── Standard executor imports ──────────────────────────────────────────────

import { executeMorpheusModelManagement } from "./custom/morpheusModelManagementExecutor";
import { executeNARecolor } from "./custom/naRecolorExecutor";
import { executeNASketchToPhoto } from "./custom/naSketchToPhotoExecutor";
import { executeNAStylingDetail } from "./custom/naStylingDetailExecutor";
import { executeGenerate3D } from "./generate3dExecutor";
import { executeGenerateAudio } from "./generateAudioExecutor";
import { executeGenerateVideo } from "./generateVideoExecutor";
import { executeLlmGenerate } from "./llmGenerateExecutor";
import { executeNanoBanana } from "./nanoBananaExecutor";
import {
  executeAnnotation,
  executeArray,
  executePrompt,
  executePromptConstructor,
  executeOutput,
  executeOutputGallery,
  executeImageCompare,
  executeGlbViewer,
  executeRouter,
  executeSwitch,
  executeConditionalSwitch,
  executeVideoInput,
} from "./simpleNodeExecutors";
import { executeSplitGrid } from "./splitGridExecutor";
import { executeVideoStitch, executeEaseCurve, executeVideoTrim, executeVideoFrameGrab } from "./videoProcessingExecutors";
import type { NodeExecutionContext } from "./types";

// ── No-op sentinels ────────────────────────────────────────────────────────

const NOOP = async (_ctx: NodeExecutionContext) => { /* display-only — no execution */ };
const PASSTHROUGH = async (_ctx: NodeExecutionContext) => { /* data source — no execution */ };

// ── Registration ───────────────────────────────────────────────────────────

let registered = false;

/**
 * Register all executor functions with the NodeSpec registry.
 * Idempotent — safe to call multiple times.
 */
export function registerAllExecutors(): void {
  if (registered) return;
  registered = true;

  // Sentinels
  nodeSpecRegistry.registerExecutor("__passthrough__", PASSTHROUGH as never);
  nodeSpecRegistry.registerExecutor("__noop__", NOOP as never);

  // Foundation — input nodes
  nodeSpecRegistry.registerExecutor("executeAudioInput", PASSTHROUGH as never); // handled inline with upload merge
  nodeSpecRegistry.registerExecutor("executeVideoInput", executeVideoInput as never);

  // Foundation — processing
  nodeSpecRegistry.registerExecutor("executeAnnotation", executeAnnotation as never);
  nodeSpecRegistry.registerExecutor("executePrompt", executePrompt as never);
  nodeSpecRegistry.registerExecutor("executeArray", executeArray as never);
  nodeSpecRegistry.registerExecutor("executePromptConstructor", executePromptConstructor as never);
  nodeSpecRegistry.registerExecutor("executeSplitGrid", executeSplitGrid as never);
  nodeSpecRegistry.registerExecutor("executeVideoStitch", executeVideoStitch as never);
  nodeSpecRegistry.registerExecutor("executeEaseCurve", executeEaseCurve as never);
  nodeSpecRegistry.registerExecutor("executeVideoTrim", executeVideoTrim as never);
  nodeSpecRegistry.registerExecutor("executeVideoFrameGrab", executeVideoFrameGrab as never);

  // Foundation — generation
  nodeSpecRegistry.registerExecutor("executeNanoBanana", executeNanoBanana as never);
  nodeSpecRegistry.registerExecutor("executeGenerateVideo", executeGenerateVideo as never);
  nodeSpecRegistry.registerExecutor("executeGenerate3D", executeGenerate3D as never);
  nodeSpecRegistry.registerExecutor("executeGenerateAudio", executeGenerateAudio as never);
  nodeSpecRegistry.registerExecutor("executeLlmGenerate", executeLlmGenerate as never);

  // Foundation — output
  nodeSpecRegistry.registerExecutor("executeOutput", executeOutput as never);
  nodeSpecRegistry.registerExecutor("executeOutputGallery", executeOutputGallery as never);
  nodeSpecRegistry.registerExecutor("executeImageCompare", executeImageCompare as never);

  // Foundation — logic
  nodeSpecRegistry.registerExecutor("executeRouter", executeRouter as never);
  nodeSpecRegistry.registerExecutor("executeSwitch", executeSwitch as never);
  nodeSpecRegistry.registerExecutor("executeConditionalSwitch", executeConditionalSwitch as never);

  // Foundation — utility
  nodeSpecRegistry.registerExecutor("executeGlbViewer", executeGlbViewer as never);

  // Neural Atelier pack
  nodeSpecRegistry.registerExecutor("executeNASketchToPhoto", executeNASketchToPhoto as never);
  nodeSpecRegistry.registerExecutor("executeNAStylingDetail", executeNAStylingDetail as never);
  nodeSpecRegistry.registerExecutor("executeNARecolor", executeNARecolor as never);

  // Morpheus pack
  nodeSpecRegistry.registerExecutor("executeMorpheusModelManagement", executeMorpheusModelManagement as never);
}
