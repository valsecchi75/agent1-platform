/**
 * Central node dispatcher.
 *
 * Maps a node's type to the correct executor function, eliminating the
 * duplicated switch/if-else chains that previously existed in
 * executeWorkflow, regenerateNode, and executeSelectedNodes.
 */

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
import type { NodeExecutionContext } from "./types";
import { executeVideoStitch, executeEaseCurve, executeVideoTrim, executeVideoFrameGrab } from "./videoProcessingExecutors";

export interface ExecuteNodeOptions {
  /** When true, executors that support it will fall back to stored inputs. */
  useStoredFallback?: boolean;
}

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

/**
 * Execute a single node by dispatching to the appropriate executor.
 *
 * Data-source node types (`imageInput`, `audioInput`) are no-ops.
 */
export async function executeNode(
  ctx: NodeExecutionContext,
  options?: ExecuteNodeOptions,
): Promise<void> {
  const regenOpts = options?.useStoredFallback ? { useStoredFallback: true } : undefined;
  const startTime = Date.now();

  try {
    switch (ctx.node.type) {
      case "imageInput":
        // Data source node — no execution needed
        break;
      case "audioInput": {
        // If audio is connected from upstream, use it (connection wins over upload)
        const audioInputs = ctx.getConnectedInputs(ctx.node.id);
        if (audioInputs.audio.length > 0 && audioInputs.audio[0]) {
          ctx.updateNodeData(ctx.node.id, { audioFile: audioInputs.audio[0] });
        }
        break;
      }
      case "videoInput": {
        // If video is connected from upstream, use it (connection wins over upload)
        const videoInputs = ctx.getConnectedInputs(ctx.node.id);
        if (videoInputs.videos.length > 0 && videoInputs.videos[0]) {
          ctx.updateNodeData(ctx.node.id, { video: videoInputs.videos[0] });
        }
        break;
      }
      case "annotation":
        await executeAnnotation(ctx);
        break;
      case "prompt":
        await executePrompt(ctx);
        break;
      case "array":
        await executeArray(ctx);
        break;
      case "promptConstructor":
        await executePromptConstructor(ctx);
        break;
      case "nanoBanana": {
        const provider = String(ctx.node.data?.provider || "nano-banana");
        const model = String(ctx.node.data?.model || "nano-banana");
        await executeNanoBanana(ctx, regenOpts);
        const durationMs = Date.now() - startTime;
        logNodeToDb(
          ctx.node.type,
          provider,
          model,
          0.039, // estimated cost for 1K generation
          durationMs,
          "success",
          "generation",
        ).catch(() => {});
        break;
      }
      case "generateVideo": {
        const provider = String(ctx.node.data?.provider || "veo");
        const model = String(ctx.node.data?.model || "veo-3.1");
        await executeGenerateVideo(ctx, regenOpts);
        const durationMs = Date.now() - startTime;
        logNodeToDb(
          ctx.node.type,
          provider,
          model,
          0.5, // estimated cost for video
          durationMs,
          "success",
          "generation",
        ).catch(() => {});
        break;
      }
      case "generate3d": {
        const provider = String(ctx.node.data?.provider || "kie");
        const model = String(ctx.node.data?.model || "kie-3d");
        await executeGenerate3D(ctx, regenOpts);
        const durationMs = Date.now() - startTime;
        logNodeToDb(
          ctx.node.type,
          provider,
          model,
          0.1, // estimated cost for 3D
          durationMs,
          "success",
          "generation",
        ).catch(() => {});
        break;
      }
      case "llmGenerate": {
        const provider = String(ctx.node.data?.provider || "gemini");
        const model = String(ctx.node.data?.model || "gemini-3-flash-preview");
        await executeLlmGenerate(ctx, regenOpts);
        const durationMs = Date.now() - startTime;
        logNodeToDb(
          ctx.node.type,
          provider,
          model,
          0.01, // estimated cost for LLM
          durationMs,
          "success",
          "llm_analysis",
        ).catch(() => {});
        break;
      }
      case "splitGrid":
        await executeSplitGrid(ctx);
        break;
      case "output":
        await executeOutput(ctx);
        break;
      case "outputGallery":
        await executeOutputGallery(ctx);
        break;
      case "imageCompare":
        await executeImageCompare(ctx);
        break;
      case "videoStitch":
        await executeVideoStitch(ctx);
        break;
      case "easeCurve":
        await executeEaseCurve(ctx);
        break;
      case "videoTrim":
        await executeVideoTrim(ctx);
        break;
      case "glbViewer":
        await executeGlbViewer(ctx);
        break;
      case "generateAudio": {
        const provider = String(ctx.node.data?.provider || "wavespeed");
        const model = String(ctx.node.data?.model || "wavespeed-audio");
        await executeGenerateAudio(ctx, regenOpts);
        const durationMs = Date.now() - startTime;
        logNodeToDb(
          ctx.node.type,
          provider,
          model,
          0.05, // estimated cost for audio
          durationMs,
          "success",
          "generation",
        ).catch(() => {});
        break;
      }
      case "videoFrameGrab":
        await executeVideoFrameGrab(ctx);
        break;
      case "router":
        await executeRouter(ctx);
        break;
      case "switch":
        await executeSwitch(ctx);
        break;
      case "conditionalSwitch":
        await executeConditionalSwitch(ctx);
        break;
      // Neural Atelier custom nodes
      case "naSketchToPhoto":
        await executeNASketchToPhoto(ctx);
        break;
      case "naStylingDetail":
        await executeNAStylingDetail(ctx);
        break;
      case "naRecolor":
        await executeNARecolor(ctx);
        break;
      // Foundation utility nodes (display-only — content received via useEffect)
      case "previewImage":
      case "showAnything":
        break;
      // Morpheus custom nodes
      case "morpheusModelManagement":
        await executeMorpheusModelManagement(ctx);
        break;
    }
  } catch (err) {
    // Log error for API-calling nodes
    const apiCallingNodes = ["nanoBanana", "generateVideo", "generate3d", "llmGenerate", "generateAudio"];
    if (apiCallingNodes.includes(ctx.node.type)) {
      const provider = String(ctx.node.data?.provider || ctx.node.type);
      const model = String(ctx.node.data?.model || "unknown");
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const callType = ctx.node.type === "llmGenerate" ? "llm_analysis" : "generation";
      logNodeToDb(
        ctx.node.type,
        provider,
        model,
        0,
        durationMs,
        "error",
        callType,
        errorMessage,
      ).catch(() => {});
    }
    throw err;
  }
}
