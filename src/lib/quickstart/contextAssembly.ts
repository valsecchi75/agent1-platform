/**
 * Context Assembly — Step 2 of RAG Pipeline
 *
 * NO LLM CALL. Pure code that loads full node specs and finds similar templates
 * to use as few-shot examples in the generation step.
 *
 * Outputs: Full node specs + similar templates (up to 2) for the generation prompt.
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { getNodeSpec, NodeIndex } from "@/lib/nodeIndex";
import { IntentAnalysisResult } from "@/lib/quickstart/intentAnalysis";
import { logger } from "@/utils/logger";

export interface NodeSpecFull {
  nodeType: string;
  name: string;
  category: string;
  description?: string;
  inputs?: Array<{ name: string; type: string; description?: string }>;
  outputs?: Array<{ name: string; type: string; description?: string }>;
  requiresApiKey?: boolean;
  configOptions?: Record<string, unknown>;
  notes?: string;
}

export interface TemplateForAssembly {
  name: string;
  description?: string;
  nodeCount: number;
  nodes: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

export interface AssembledContext {
  /** Full specs keyed by nodeType */
  nodeSpecs: Record<string, NodeSpecFull>;

  /** Similar templates (max 2) to use as few-shot examples */
  similarTemplates: TemplateForAssembly[];

  /** Estimated total tokens for assembly (for planning) */
  totalTokenEstimate: number;
}

/**
 * Get the storage templates directory path
 */
function getTemplatesDir(): string {
  const cwd = process.cwd();
  return path.join(cwd, "storage", "templates");
}

/**
 * List all available templates (synchronously, returns template.json paths)
 */
function listTemplateJsonPaths(): string[] {
  try {
    const templatesDir = getTemplatesDir();
    const entries = fsSync.readdirSync(templatesDir, { withFileTypes: true });

    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(templatesDir, e.name, "template.json"))
      .filter((p) => {
        try {
          fsSync.accessSync(p);
          return true;
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Load and parse a template JSON file
 */
async function loadTemplate(templatePath: string): Promise<TemplateForAssembly | null> {
  try {
    const content = await fs.readFile(templatePath, "utf-8");
    const parsed = JSON.parse(content);

    // Extract nodes and edges, stripping large data
    const nodes = (parsed.nodes || []).map((n: Record<string, unknown>) => ({
      id: n.id || "unknown",
      type: n.type || "prompt",
      data: stripNodeData((n.data || {}) as Record<string, unknown>),
      position: n.position,
    }));

    const edges = (parsed.edges || []).map((e: Record<string, unknown>) => ({
      id: e.id || "edge",
      source: e.source || "",
      target: e.target || "",
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));

    return {
      name: parsed.name || "Untitled Template",
      description: parsed.description,
      nodeCount: nodes.length,
      nodes,
      edges,
    };
  } catch (error) {
    logger.warn("api.llm", "[RAG] Failed to load template", { path: templatePath });
    return null;
  }
}

/**
 * Strip large data (images, base64) from node data to save tokens
 */
function stripNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip base64 images and large binary data
    if (key.includes("image") && typeof value === "string" && value.startsWith("data:")) {
      stripped[key] = "[image_stripped]";
    } else if (key.includes("video") && typeof value === "string" && value.startsWith("data:")) {
      stripped[key] = "[video_stripped]";
    } else if (key.includes("audio") && typeof value === "string" && value.startsWith("data:")) {
      stripped[key] = "[audio_stripped]";
    } else if (typeof value === "string" && value.length > 500) {
      stripped[key] = value.substring(0, 100) + "...[truncated]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      stripped[key] = stripNodeData(value as Record<string, unknown>);
    } else {
      stripped[key] = value;
    }
  }

  return stripped;
}

/**
 * Calculate overlap score between intent nodes and template nodes
 */
function calculateTemplateScore(
  intentNodeTypes: Set<string>,
  templateNodeTypes: Set<string>
): number {
  const intersection = [...intentNodeTypes].filter((t) => templateNodeTypes.has(t)).length;
  const union = new Set([...intentNodeTypes, ...templateNodeTypes]).size;

  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Estimate tokens for context assembly (rough calculation)
 */
function estimateTokens(
  nodeSpecs: Record<string, NodeSpecFull>,
  templates: TemplateForAssembly[]
): number {
  let tokens = 0;

  // Node specs: roughly 200 tokens per spec
  tokens += Object.keys(nodeSpecs).length * 200;

  // Templates: roughly 300 tokens per template
  tokens += templates.length * 300;

  return tokens;
}

/**
 * Assemble context for generation step
 *
 * Step 2 of RAG pipeline (NO LLM CALL):
 * - Load full specs for each selected node type
 * - Scan templates directory for similar workflows
 * - Return top 2 similar templates as few-shot examples
 * - Strip large data to save tokens
 *
 * @param intentResult Output from intent analysis
 * @returns Full specs + similar templates + token estimate
 */
export async function assembleContext(
  intentResult: IntentAnalysisResult
): Promise<AssembledContext> {
  logger.info("api.llm", "[RAG] Step 2: Assembling context", {
    selectedNodeCount: intentResult.selectedNodes.length,
  });

  // Step 1: Load full specs for each selected node type
  const nodeSpecs: Record<string, NodeSpecFull> = {};

  for (const selectedNode of intentResult.selectedNodes) {
    try {
      const spec = await getNodeSpec(selectedNode.nodeType);
      if (spec) {
        nodeSpecs[selectedNode.nodeType] = spec as NodeSpecFull;
      }
    } catch (error) {
      logger.warn("api.llm", "[RAG] Failed to load spec for node", {
        nodeType: selectedNode.nodeType,
      });
    }
  }

  logger.info("api.llm", "[RAG] Step 2: Loaded node specs", {
    loadedSpecCount: Object.keys(nodeSpecs).length,
  });

  // Step 2: Find similar templates
  const similarTemplates: TemplateForAssembly[] = [];
  const intentNodeTypes = new Set(intentResult.selectedNodes.map((n) => n.nodeType));

  try {
    const templatePaths = listTemplateJsonPaths();

    // Score all templates and sort by relevance
    const scoredTemplates: Array<{
      path: string;
      score: number;
    }> = [];

    for (const templatePath of templatePaths) {
      const template = await loadTemplate(templatePath);

      if (template) {
        const templateNodeTypes = new Set(template.nodes.map((n) => n.type));
        const score = calculateTemplateScore(intentNodeTypes, templateNodeTypes);

        if (score > 0) {
          scoredTemplates.push({ path: templatePath, score });
        }
      }
    }

    // Sort by score and take top 2
    scoredTemplates.sort((a, b) => b.score - a.score);

    for (const { path: templatePath } of scoredTemplates.slice(0, 2)) {
      const template = await loadTemplate(templatePath);
      if (template) {
        similarTemplates.push(template);
      }
    }

    logger.info("api.llm", "[RAG] Step 2: Found similar templates", {
      templateCount: similarTemplates.length,
    });
  } catch (error) {
    logger.warn("api.llm", "[RAG] Failed to scan templates directory", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Estimate total tokens
  const totalTokenEstimate = estimateTokens(nodeSpecs, similarTemplates);

  const context: AssembledContext = {
    nodeSpecs,
    similarTemplates,
    totalTokenEstimate,
  };

  logger.info("api.llm", "[RAG] Step 2: Context assembly complete", {
    specCount: Object.keys(nodeSpecs).length,
    templateCount: similarTemplates.length,
    estimatedTokens: totalTokenEstimate,
  });

  return context;
}
