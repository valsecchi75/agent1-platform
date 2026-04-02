/**
 * Intent Analysis — Step 1 of RAG Pipeline
 *
 * Takes a user description and node index, uses LLM to understand intent,
 * select appropriate nodes, and plan connections between them.
 *
 * Output: Selected nodes, intended connections, missing capabilities.
 */

import { NodeIndex, NodeIndexEntry } from "@/lib/nodeIndex";
import { LLMProvider, LLMResponse } from "@/lib/quickstart/llmProvider";
import { logger } from "@/utils/logger";

export interface IntentAnalysisResult {
  /** Brief description of what the user wants */
  intent: string;

  /** Selected node types and how many of each */
  selectedNodes: Array<{
    nodeType: string;
    count: number;
    purpose: string;
  }>;

  /** Planned connections between nodes */
  connections: Array<{
    from: string; // nodeType
    to: string; // nodeType
    handleType: string; // "image" | "text" | "audio" | "video" | "3d" | "easeCurve" | "reference"
    reason: string;
  }>;

  /** Capabilities the user requested that we don't have nodes for */
  missingCapabilities: string[];

  /** Suggested workflow name based on intent */
  suggestedName: string;
}

/**
 * Format node index for LLM consumption (compact, <2K tokens)
 */
function formatNodeIndexForLLM(index: NodeIndex): string {
  return index.nodes
    .map((node) => {
      const inputs = node.inputTypes.length > 0 ? node.inputTypes.join(", ") : "none";
      const outputs = node.outputTypes.length > 0 ? node.outputTypes.join(", ") : "none";

      return `- ${node.nodeType} (${node.name}): ${node.summary || node.category}. Inputs: [${inputs}]. Outputs: [${outputs}]`;
    })
    .join("\n");
}

/**
 * Build system prompt for intent analysis
 */
function buildIntentSystemPrompt(nodeIndex: NodeIndex): string {
  const nodesList = formatNodeIndexForLLM(nodeIndex);

  return `You are a workflow designer assistant. Your job is to analyze a user's creative request and recommend which nodes to use and how to connect them.

# Available Nodes
${nodesList}

# Connection Rules
- Nodes connect left-to-right (output → input)
- Connect by matching output and input types (image → image, text → text, etc.)
- Reference handle allows flexible connections
- Each node can have multiple inputs and outputs

# Output Format
You MUST respond with ONLY valid JSON (no markdown, no extra text). Example:
{
  "intent": "Generate an image from text, then enhance it",
  "selectedNodes": [
    { "nodeType": "prompt", "count": 1, "purpose": "User provides text description" },
    { "nodeType": "nanoBanana", "count": 1, "purpose": "Generate image from text" },
    { "nodeType": "llmGenerate", "count": 1, "purpose": "Analyze and enhance the result" }
  ],
  "connections": [
    { "from": "prompt", "to": "nanoBanana", "handleType": "text", "reason": "Pass description to generator" },
    { "from": "nanoBanana", "to": "llmGenerate", "handleType": "image", "reason": "Pass generated image for analysis" }
  ],
  "missingCapabilities": [],
  "suggestedName": "Text-to-Image Enhancement"
}

# Analysis Steps
1. Understand what the user wants to create
2. Map their needs to available node types
3. Plan a left-to-right flow
4. Note any capabilities we can't fulfill`;
}

/**
 * Parse intent analysis JSON response from LLM
 */
function parseIntentResponse(text: string): IntentAnalysisResult {
  // Try to extract JSON from response
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    // Try markdown code block
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) {
      try {
        json = JSON.parse(blockMatch[1].trim());
      } catch {
        throw new Error("Failed to parse JSON from code block");
      }
    } else {
      throw new Error("Could not find JSON in response");
    }
  }

  // Validate structure
  if (!json || typeof json !== "object") {
    throw new Error("Response is not a JSON object");
  }

  const obj = json as Record<string, unknown>;

  // Ensure required fields exist with defaults
  const result: IntentAnalysisResult = {
    intent: typeof obj.intent === "string" ? obj.intent : "User request",
    selectedNodes: Array.isArray(obj.selectedNodes)
      ? (obj.selectedNodes as Array<Record<string, unknown>>)
          .filter(
            (n) =>
              typeof n === "object" &&
              typeof n.nodeType === "string" &&
              typeof n.count === "number"
          )
          .map((n) => ({
            nodeType: n.nodeType as string,
            count: n.count as number,
            purpose: typeof n.purpose === "string" ? n.purpose : "",
          }))
      : [],
    connections: Array.isArray(obj.connections)
      ? (obj.connections as Array<Record<string, unknown>>)
          .filter(
            (c) =>
              typeof c === "object" &&
              typeof c.from === "string" &&
              typeof c.to === "string"
          )
          .map((c) => ({
            from: c.from as string,
            to: c.to as string,
            handleType: typeof c.handleType === "string" ? c.handleType : "text",
            reason: typeof c.reason === "string" ? c.reason : "",
          }))
      : [],
    missingCapabilities: Array.isArray(obj.missingCapabilities)
      ? obj.missingCapabilities
          .filter((m: unknown) => typeof m === "string")
          .map((m: unknown) => m as string)
      : [],
    suggestedName: typeof obj.suggestedName === "string" ? obj.suggestedName : "Generated Workflow",
  };

  return result;
}

/**
 * Analyze user intent and select nodes
 *
 * Step 1 of RAG pipeline:
 * - Present node index to LLM
 * - Ask LLM to select appropriate nodes
 * - Parse and validate selection
 *
 * @param userPrompt The user's workflow description
 * @param nodeIndex Available nodes from custom_nodes/_index.json
 * @param llm LLM provider to use
 * @returns Selected nodes, connections, and suggested name
 * @throws Error if analysis fails or no nodes selected
 */
export async function analyzeIntent(
  userPrompt: string,
  nodeIndex: NodeIndex,
  llm: LLMProvider
): Promise<IntentAnalysisResult> {
  logger.info("api.llm", "[RAG] Step 1: Analyzing intent", {
    promptLength: userPrompt.length,
    availableNodeTypes: nodeIndex.nodeCount,
  });

  const systemPrompt = buildIntentSystemPrompt(nodeIndex);

  try {
    const response: LLMResponse = await llm.call(userPrompt, systemPrompt, {
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    logger.info("api.llm", "[RAG] Step 1: LLM response received", {
      responseLength: response.text.length,
      provider: response.provider,
      model: response.model,
    });

    const result = parseIntentResponse(response.text);

    logger.info("api.llm", "[RAG] Step 1: Intent analysis complete", {
      nodeCount: result.selectedNodes.length,
      connectionCount: result.connections.length,
      missingCapabilities: result.missingCapabilities,
      suggestedName: result.suggestedName,
    });

    // Validate that we selected at least one node
    if (result.selectedNodes.length === 0) {
      throw new Error("No nodes selected for this workflow. Please provide more detail about what you want to create.");
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("api.error", "[RAG] Step 1: Intent analysis failed", { userPrompt }, error instanceof Error ? error : undefined);
    throw new Error(`Failed to analyze intent: ${errorMsg}`);
  }
}
