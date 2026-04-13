/**
 * RAG Pipeline Orchestrator
 *
 * Ties together the 3-step RAG (Retrieval-Augmented Generation) pipeline:
 * 1. Intent Analysis — Understand user request and select nodes
 * 2. Context Assembly — Load specs and find similar templates
 * 3. Workflow Generation — Generate and validate workflow JSON
 *
 * Main entry point for converting user descriptions into workflows.
 */

import { WorkflowFile } from "@/store/workflowStore";
import { getNodeIndex, NodeIndex } from "@/lib/nodeIndex";
import { getAvailableProvider, LLMProvider } from "@/lib/quickstart/llmProvider";
import { analyzeIntent, IntentAnalysisResult } from "@/lib/quickstart/intentAnalysis";
import { assembleContext, AssembledContext } from "@/lib/quickstart/contextAssembly";
import { generateWorkflow } from "@/lib/quickstart/workflowGeneration";
import { logger } from "@/utils/logger";

export interface RAGPipelineOptions {
  /** Preferred LLM provider ID (falls back to first available) */
  preferredProvider?: string;

  /** Content detail level: "empty", "minimal", or "full" */
  contentLevel?: string;

  /** Enable detailed logging */
  verbose?: boolean;
}

export interface RAGPipelineResult {
  /** Generated workflow ready to use */
  workflow: WorkflowFile;

  /** Metadata about the generation process */
  metadata: {
    provider: string;
    model: string;
    steps: Array<{
      name: string;
      duration: number;
      success: boolean;
    }>;
    totalDuration: number;
    nodeIndexSize: number;
    intentAnalysisResult: IntentAnalysisResult;
    contextAssemblyResult: AssembledContext;
  };
}

/**
 * Run the complete RAG pipeline
 *
 * Orchestrates the 3-step process:
 * 1. Analyzes user intent and selects nodes
 * 2. Assembles context (specs + similar templates)
 * 3. Generates and validates workflow
 *
 * @param userPrompt User's workflow description
 * @param options Pipeline configuration
 * @returns Generated workflow + metadata
 * @throws Error with clear message if any step fails
 */
export async function runRAGPipeline(
  userPrompt: string,
  options?: RAGPipelineOptions
): Promise<RAGPipelineResult> {
  const verbose = options?.verbose ?? false;
  const contentLevel = options?.contentLevel ?? "empty";
  const pipelineStartTime = Date.now();

  logger.info("api.llm", "[RAG] Pipeline starting", {
    userPromptLength: userPrompt.length,
    contentLevel,
    preferredProvider: options?.preferredProvider,
  });

  const steps: Array<{
    name: string;
    duration: number;
    success: boolean;
  }> = [];

  try {
    // ── Step 0: Get LLM Provider ──────────────────────────────────────────────────

    let llmProvider: LLMProvider | null = null;

    if (options?.preferredProvider) {
      llmProvider = getAvailableProvider(options.preferredProvider);
      if (!llmProvider) {
        throw new Error(
          `Preferred LLM provider "${options.preferredProvider}" is not available. ` +
            `Check that the API key is configured in .env.local or Settings.`
        );
      }
    } else {
      llmProvider = getAvailableProvider();
      if (!llmProvider) {
        throw new Error(
          "No LLM provider available. Configure at least one API key " +
            "(Gemini, Anthropic, or OpenAI) in .env.local or Settings."
        );
      }
    }

    logger.info("api.llm", "[RAG] LLM provider selected", {
      provider: llmProvider.id,
      name: llmProvider.name,
    });

    // ── Step 0: Load Node Index ───────────────────────────────────────────────────

    logger.info("api.llm", "[RAG] Loading node index");
    let nodeIndex: NodeIndex | null = null;

    try {
      nodeIndex = await getNodeIndex();
      logger.info("api.llm", "[RAG] Node index loaded", {
        nodeCount: nodeIndex.nodeCount,
      });
    } catch (error) {
      throw new Error(
        `Failed to load node index: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!nodeIndex || nodeIndex.nodeCount === 0) {
      throw new Error(
        "No nodes available. Install custom nodes first via " +
          "Settings → Templates → Neural Atelier or other packs."
      );
    }

    // ── Step 1: Intent Analysis ───────────────────────────────────────────────────

    const step1Start = Date.now();
    logger.info("api.llm", "[RAG] Step 1: Starting intent analysis");

    let intentResult: IntentAnalysisResult;

    try {
      intentResult = await analyzeIntent(userPrompt, nodeIndex, llmProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("api.error", "[RAG] Step 1 failed", { error: msg });
      throw error; // Re-throw to be caught by outer try/catch
    }

    const step1Duration = Date.now() - step1Start;
    steps.push({
      name: "Intent Analysis",
      duration: step1Duration,
      success: true,
    });

    if (verbose) {
      logger.info("api.llm", "[RAG] Step 1 complete", {
        duration: step1Duration,
        selectedNodes: intentResult.selectedNodes.length,
      });
    }

    // ── Step 2: Context Assembly ──────────────────────────────────────────────────

    const step2Start = Date.now();
    logger.info("api.llm", "[RAG] Step 2: Starting context assembly");

    let contextResult: AssembledContext;

    try {
      contextResult = await assembleContext(intentResult);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("api.error", "[RAG] Step 2 failed", { error: msg });
      throw new Error(`Context assembly failed: ${msg}`);
    }

    const step2Duration = Date.now() - step2Start;
    steps.push({
      name: "Context Assembly",
      duration: step2Duration,
      success: true,
    });

    if (verbose) {
      logger.info("api.llm", "[RAG] Step 2 complete", {
        duration: step2Duration,
        specsLoaded: Object.keys(contextResult.nodeSpecs).length,
        templatesFound: contextResult.similarTemplates.length,
      });
    }

    // ── Step 3: Workflow Generation ───────────────────────────────────────────────

    const step3Start = Date.now();
    logger.info("api.llm", "[RAG] Step 3: Starting workflow generation");

    let workflow: WorkflowFile;

    try {
      workflow = await generateWorkflow(
        userPrompt,
        intentResult,
        contextResult,
        llmProvider,
        contentLevel
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("api.error", "[RAG] Step 3 failed", { error: msg });
      throw error; // Re-throw to be caught by outer try/catch
    }

    const step3Duration = Date.now() - step3Start;
    steps.push({
      name: "Workflow Generation",
      duration: step3Duration,
      success: true,
    });

    if (verbose) {
      logger.info("api.llm", "[RAG] Step 3 complete", {
        duration: step3Duration,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length,
      });
    }

    // ── Final Assembly ────────────────────────────────────────────────────────────

    const totalDuration = Date.now() - pipelineStartTime;

    logger.info("api.llm", "[RAG] Pipeline complete", {
      totalDuration,
      workflowName: workflow.name,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
    });

    const result: RAGPipelineResult = {
      workflow,
      metadata: {
        provider: llmProvider.id,
        model: (llmProvider as any).model || "unknown",
        steps,
        totalDuration,
        nodeIndexSize: nodeIndex.nodeCount,
        intentAnalysisResult: intentResult,
        contextAssemblyResult: contextResult,
      },
    };

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error("api.error", "[RAG] Pipeline failed", {
      error: errorMsg,
      completedSteps: steps.length,
    });

    // Re-throw with consistent error format
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`RAG pipeline failed: ${errorMsg}`);
  }
}

/**
 * Quick utility: Run pipeline with minimal options (for testing/debugging)
 */
export async function quickGenerateWorkflow(userPrompt: string): Promise<WorkflowFile> {
  const result = await runRAGPipeline(userPrompt, {
    contentLevel: "empty",
    verbose: false,
  });

  return result.workflow;
}
