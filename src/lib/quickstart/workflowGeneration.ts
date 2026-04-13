/**
 * Workflow Generation — Step 3 of RAG Pipeline
 *
 * Takes assembled context + intent + user prompt, sends to LLM, validates and repairs
 * the returned workflow JSON.
 *
 * Outputs: Validated WorkflowFile ready for use.
 */

import { WorkflowFile } from "@/store/workflowStore";
import {
  validateWorkflowJSON,
  repairWorkflowJSON,
  parseJSONFromResponse,
} from "@/lib/quickstart/validation";
import { LLMProvider, LLMResponse } from "@/lib/quickstart/llmProvider";
import { IntentAnalysisResult } from "@/lib/quickstart/intentAnalysis";
import { AssembledContext } from "@/lib/quickstart/contextAssembly";
import { logger } from "@/utils/logger";

/**
 * Format node specs for inclusion in LLM prompt
 */
function formatNodeSpecsForPrompt(specs: Record<string, unknown>): string {
  return Object.entries(specs)
    .map(([nodeType, spec]) => {
      const s = spec as Record<string, unknown>;
      const description = s.description || s.summary || "";
      const inputs = Array.isArray(s.inputs)
        ? (s.inputs as Array<Record<string, unknown>>)
            .map((i) => `${i.name}: ${i.type}`)
            .join(", ")
        : "none";
      const outputs = Array.isArray(s.outputs)
        ? (s.outputs as Array<Record<string, unknown>>)
            .map((o) => `${o.name}: ${o.type}`)
            .join(", ")
        : "none";

      return `## ${nodeType}
**Name:** ${s.name || nodeType}
**Description:** ${description}
**Inputs:** ${inputs}
**Outputs:** ${outputs}`;
    })
    .join("\n\n");
}

/**
 * Format intent result for prompt
 */
function formatIntentForPrompt(intent: IntentAnalysisResult): string {
  const nodesSummary = intent.selectedNodes
    .map((n) => `- ${n.nodeType} (${n.count}x): ${n.purpose}`)
    .join("\n");

  const connectionsSummary = intent.connections
    .map((c) => `- ${c.from} → ${c.to} (${c.handleType}): ${c.reason}`)
    .join("\n");

  return `# Workflow Intent
**Goal:** ${intent.intent}
**Suggested Name:** ${intent.suggestedName}

## Selected Nodes
${nodesSummary}

## Planned Connections
${connectionsSummary}
${intent.missingCapabilities.length > 0 ? `\n**Note:** These capabilities were requested but not available: ${intent.missingCapabilities.join(", ")}` : ""}`;
}

/**
 * Format a template as a few-shot example
 */
function formatTemplateExample(name: string, template: any): string {
  return `# Example: ${name}
\`\`\`json
{
  "version": 1,
  "name": "${template.name || name}",
  "nodes": ${JSON.stringify(template.nodes.slice(0, 3), null, 2)},
  "edges": ${JSON.stringify(template.edges.slice(0, 3), null, 2)}
}
\`\`\``;
}

/**
 * Build system prompt for workflow generation
 */
function buildGenerationSystemPrompt(
  context: AssembledContext,
  intent: IntentAnalysisResult,
  contentLevel: string
): string {
  const nodeSpecsText = formatNodeSpecsForPrompt(context.nodeSpecs);
  const intentText = formatIntentForPrompt(intent);

  const examplesText =
    context.similarTemplates.length > 0
      ? `# Examples of Similar Workflows\n${context.similarTemplates
          .map((t) => formatTemplateExample(t.name, t))
          .join("\n\n")}`
      : "# No Similar Examples Available\n(Generate based on intent and specs alone)";

  const contentInstructions = buildContentInstructions(contentLevel);

  return `You are a workflow architect. Generate a complete, valid ReactFlow workflow JSON based on the intent and node specifications provided.

${intentText}

${nodeSpecsText}

${examplesText}

${contentInstructions}

# Layout Rules
- Position nodes left-to-right (500px spacing between columns)
- First column (inputs) at x=50
- Middle columns (processing) at x=550, x=1050, etc.
- Output nodes on the right
- Vertical spacing of 150px between nodes
- Use curved edges (edgeStyle: "curved")

# Output Requirements
1. Generate ONLY valid JSON (no markdown, no commentary)
2. Include all selected nodes from the intent
3. Create connections based on the planned connections
4. Use proper node IDs: "{type}-{number}" (e.g., "prompt-1", "nanoBanana-2")
5. Use proper edge IDs: "edge-{source}-{target}-{sourceHandle}-{targetHandle}"
6. Every node must have valid data for its type
7. All edges must connect nodes that exist and have compatible handle types

# Required Workflow Structure
{
  "version": 1,
  "id": "wf_[generated_uuid]",
  "name": "[workflow_name]",
  "nodes": [
    {
      "id": "prompt-1",
      "type": "prompt",
      "position": { "x": 50, "y": 100 },
      "data": { "prompt": "" },
      "style": { "width": 320, "height": 220 }
    }
  ],
  "edges": [
    {
      "id": "edge-prompt-1-nanoBanana-1-text-text",
      "source": "prompt-1",
      "sourceHandle": "text",
      "target": "nanoBanana-1",
      "targetHandle": "text"
    }
  ],
  "edgeStyle": "curved"
}

# Checklist Before Output
- [ ] Workflow is valid JSON
- [ ] version = 1
- [ ] Has unique id
- [ ] Has name
- [ ] nodes array contains all selected nodes
- [ ] edges connect planned node pairs
- [ ] All node IDs follow "{type}-{number}" format
- [ ] All edge IDs are present
- [ ] All nodes have position and data
- [ ] edgeStyle = "curved"`;
}

/**
 * Build content level instructions
 */
function buildContentInstructions(contentLevel: string): string {
  switch (contentLevel) {
    case "minimal":
      return `# Content Level: Minimal
- Populate only essential node fields
- Leave complex options as defaults
- Don't set optional parameters`;

    case "full":
      return `# Content Level: Full
- Populate all available node fields with sensible defaults
- Include reasonable settings for models, aspect ratios, etc.
- Make the workflow immediately runnable`;

    default:
      return `# Content Level: Empty (Default)
- Create nodes with empty/null values for user inputs
- Pre-populate any required configuration fields
- User will fill in prompts and images`;
  }
}

/**
 * Generate workflow JSON from intent and context
 *
 * Step 3 of RAG pipeline:
 * - Build comprehensive LLM prompt with node specs, intent, examples
 * - Call LLM to generate workflow JSON
 * - Parse and validate result
 * - Repair if needed
 *
 * @param userPrompt Original user description (for context)
 * @param intentResult Output from intent analysis
 * @param context Output from context assembly
 * @param llm LLM provider to use
 * @param contentLevel "empty", "minimal", or "full"
 * @returns Validated and potentially repaired workflow
 * @throws Error if generation fails
 */
export async function generateWorkflow(
  userPrompt: string,
  intentResult: IntentAnalysisResult,
  context: AssembledContext,
  llm: LLMProvider,
  contentLevel: string = "empty"
): Promise<WorkflowFile> {
  logger.info("api.llm", "[RAG] Step 3: Generating workflow", {
    nodeSpecCount: Object.keys(context.nodeSpecs).length,
    templateCount: context.similarTemplates.length,
    contentLevel,
  });

  const systemPrompt = buildGenerationSystemPrompt(context, intentResult, contentLevel);

  // Build user prompt with original intent
  const userMsg = `User Request: ${userPrompt}\n\nIntended Workflow: ${intentResult.suggestedName}\n\nGenerate the complete workflow JSON now.`;

  try {
    const response: LLMResponse = await llm.call(userMsg, systemPrompt, {
      temperature: 0.5, // Lower temperature for more deterministic JSON
      maxOutputTokens: 4096,
    });

    logger.info("api.llm", "[RAG] Step 3: LLM generation response received", {
      responseLength: response.text.length,
      provider: response.provider,
    });

    // Step 1: Parse JSON from response
    let workflowData: unknown;
    try {
      workflowData = parseJSONFromResponse(response.text);
    } catch (parseError) {
      logger.error(
        "api.error",
        "[RAG] Step 3: Failed to parse JSON from LLM response",
        { responsePreview: response.text.substring(0, 200) },
        parseError instanceof Error ? parseError : undefined
      );
      throw new Error("LLM response was not valid JSON. Please try again.");
    }

    // Step 2: Validate workflow structure
    const validation = validateWorkflowJSON(workflowData);
    if (!validation.valid) {
      logger.warn("api.llm", "[RAG] Step 3: Workflow validation failed", {
        errors: validation.errors.slice(0, 5),
        errorCount: validation.errors.length,
      });

      // Try to repair
      logger.info("api.llm", "[RAG] Step 3: Attempting to repair workflow");
      const repaired = repairWorkflowJSON(workflowData);

      // Validate repaired version
      const repairValidation = validateWorkflowJSON(repaired);
      if (!repairValidation.valid) {
        logger.error(
          "api.error",
          "[RAG] Step 3: Repair failed, workflow still invalid",
          { errors: repairValidation.errors.slice(0, 5) }
        );
        throw new Error(
          `Workflow validation failed: ${repairValidation.errors[0]?.message || "Unknown error"}`
        );
      }

      logger.info("api.llm", "[RAG] Step 3: Workflow successfully repaired");
      return repaired;
    }

    // Workflow is valid, return it
    const workflow = workflowData as WorkflowFile;

    logger.info("api.llm", "[RAG] Step 3: Workflow generation complete", {
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      workflowName: workflow.name,
    });

    return workflow;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      "api.error",
      "[RAG] Step 3: Workflow generation failed",
      { intentName: intentResult.suggestedName },
      error instanceof Error ? error : undefined
    );
    throw new Error(`Failed to generate workflow: ${errorMsg}`);
  }
}
