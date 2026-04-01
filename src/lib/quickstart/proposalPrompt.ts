import { NodeIndex } from "@/lib/nodeIndex";

/**
 * Build a RAG-aware proposal prompt using the dynamic node index.
 * Falls back to the legacy hardcoded prompt if nodeIndex is not available.
 */
export function buildRAGProposalPrompt(
  description: string,
  nodeIndex: NodeIndex
): string {
  // Build dynamic node documentation from the index
  const nodesDocs = nodeIndex.nodes
    .map((node, i) => {
      const inputs =
        node.inputTypes.length > 0
          ? `- Inputs: ${node.inputTypes.map((t) => `"${t}" handle`).join(", ")}`
          : "";
      const outputs =
        node.outputTypes.length > 0
          ? `- Outputs: ${node.outputTypes.map((t) => `"${t}" handle`).join(", ")}`
          : "";
      const tags = node.tags.length > 0 ? `- Tags: ${node.tags.join(", ")}` : "";

      return `### ${i + 1}. ${node.nodeType}
Purpose: ${node.summary || node.name}
${inputs}
${outputs}
${tags}
- Category: ${node.category}${node.requiresApiKey ? "\n- Requires API key" : ""}`;
    })
    .join("\n\n");

  // Valid connection types from all nodes
  const allHandleTypes = new Set<string>();
  nodeIndex.nodes.forEach((n) => {
    n.inputTypes.forEach((t) => allHandleTypes.add(t));
    n.outputTypes.forEach((t) => allHandleTypes.add(t));
  });
  const handleTypesStr = [...allHandleTypes].sort().map((t) => `"${t}"`).join(", ");

  return `You are a workflow designer for AGENT 1, a visual node-based AI creative generation tool. Your task is to create a workflow PROPOSAL that can be reviewed before building the actual workflow.

## CRITICAL: OUTPUT FORMAT
You MUST output ONLY valid JSON. No explanations, no markdown, no code blocks. Just the raw JSON object starting with { and ending with }.

## Available Node Types (${nodeIndex.nodeCount} nodes)

${nodesDocs}

## Connection Rules
1. **Type matching**: Connect nodes by matching output and input handle types (${handleTypesStr})
2. **nanoBanana REQUIRES**: At least one image AND one text connection
3. **Multiple images**: nanoBanana can accept multiple image inputs for multi-reference generation
4. **Reference handle**: Allows flexible connections between compatible nodes

## WorkflowProposal Schema

Output a JSON object matching this structure:

{
  "name": "Workflow Name",
  "description": "One paragraph explaining what this workflow does and how to use it",
  "nodes": [
    {
      "id": "node-1",
      "type": "imageInput",
      "purpose": "Human-readable description of this node's role",
      "suggestedTitle": "Node title shown in UI",
      "suggestedPrompt": "For prompt nodes only: the suggested prompt text",
      "suggestedModel": "For generation nodes: the model to use",
      "suggestedSettings": { "aspectRatio": "1:1" }
    }
  ],
  "connections": [
    {
      "from": "node-1",
      "to": "node-2",
      "type": "image",
      "description": "Character image feeds into generation"
    }
  ],
  "groups": [
    {
      "name": "Input Images",
      "color": "blue",
      "nodeIds": ["node-1", "node-2"],
      "purpose": "All source images for the workflow"
    }
  ],
  "estimatedComplexity": "simple|moderate|complex",
  "warnings": ["Optional array of caveats or limitations"]
}

## Field Guidelines

**nodes[].purpose**: Explain what this node does in the workflow context
- Good: "Provides the main character photo that will be composited into new scenes"
- Bad: "Image input"

**nodes[].suggestedTitle**: Short, descriptive title for the UI
- Good: "Character Photo", "Style Reference", "Background Scene"
- Bad: "Input 1", "Node", "Image"

**nodes[].suggestedPrompt**: For prompt nodes, write helpful starter text

**connections[].description**: Explain the data flow
- Good: "Character photo provides the subject to maintain across generations"
- Bad: "Image connection"

**groups**: Only include if workflow has 4+ nodes
- colors: "neutral", "blue", "green", "purple", "orange"

**estimatedComplexity**:
- "simple": 2-4 nodes, straightforward linear flow
- "moderate": 5-8 nodes, some branching or multiple outputs
- "complex": 9+ nodes, parallel processing, multi-stage pipelines

## User's Request
"${description}"

Generate a workflow proposal that best addresses this request. Focus on clear purposes and descriptions that help the user understand each step.

OUTPUT ONLY THE JSON:`;
}

/**
 * Build a prompt for Gemini to generate a WorkflowProposal
 *
 * LEGACY: Hardcoded to 7 node types. Use buildRAGProposalPrompt when node index is available.
 *
 * Unlike buildQuickstartPrompt which generates full workflow JSON,
 * this generates a reviewable proposal structure focused on purpose
 * and connections rather than internal node state.
 */
export function buildProposalPrompt(description: string): string {
  return `You are a workflow designer for AGENT 1, a visual node-based AI image generation tool. Your task is to create a workflow PROPOSAL that can be reviewed before building the actual workflow.

## CRITICAL: OUTPUT FORMAT
You MUST output ONLY valid JSON. No explanations, no markdown, no code blocks. Just the raw JSON object starting with { and ending with }.

## Available Node Types

### 1. imageInput
Purpose: Load/display input images from user
- Outputs: "image" handle
- Use when: User needs to provide source images (photos, references, backgrounds)

### 2. prompt
Purpose: Text prompts that feed into generation or LLM nodes
- Outputs: "text" handle
- Use when: Instructions or descriptions are needed for AI generation

### 3. annotation
Purpose: Draw/annotate on images before generation
- Inputs: "image" handle
- Outputs: "image" handle
- Use when: User explicitly wants to mark up or draw on images

### 4. nanoBanana
Purpose: AI image generation (REQUIRES both image AND text inputs)
- Inputs: "image" handle (one or more), "text" handle (required)
- Outputs: "image" handle
- Use when: Generating or transforming images with AI
- Models: "nano-banana" (fast), "nano-banana-pro" (high quality)

### 5. llmGenerate
Purpose: AI text generation for prompt expansion or analysis
- Inputs: "text" handle (required), "image" handle (optional)
- Outputs: "text" handle
- Use when: Need to expand prompts, analyze images, or generate descriptions

### 6. splitGrid
Purpose: Split a grid image into cells for parallel processing
- Inputs: "image" handle
- Outputs: "reference" handle (creates child imageInput nodes)
- Use when: Processing contact sheets or generating variations

### 7. output
Purpose: Display final generated images
- Inputs: "image" handle
- Use when: Marking the final result(s) of a workflow

## Connection Rules
1. **Type matching**: "image" → "image", "text" → "text", "reference" → "reference"
2. **nanoBanana REQUIRES**: At least one image AND one text connection
3. **Multiple images**: nanoBanana can accept multiple image inputs for multi-reference generation

## WorkflowProposal Schema

Output a JSON object matching this structure:

{
  "name": "Workflow Name",
  "description": "One paragraph explaining what this workflow does and how to use it",
  "nodes": [
    {
      "id": "node-1",
      "type": "imageInput",
      "purpose": "Human-readable description of this node's role",
      "suggestedTitle": "Node title shown in UI",
      "suggestedPrompt": "For prompt nodes only: the suggested prompt text",
      "suggestedModel": "For nanoBanana: 'nano-banana' or 'nano-banana-pro'",
      "suggestedSettings": { "aspectRatio": "1:1" }
    }
  ],
  "connections": [
    {
      "from": "node-1",
      "to": "node-2",
      "type": "image",
      "description": "Character image feeds into generation"
    }
  ],
  "groups": [
    {
      "name": "Input Images",
      "color": "blue",
      "nodeIds": ["node-1", "node-2"],
      "purpose": "All source images for the workflow"
    }
  ],
  "estimatedComplexity": "simple|moderate|complex",
  "warnings": ["Optional array of caveats or limitations"]
}

## Field Guidelines

**nodes[].purpose**: Explain what this node does in the workflow context
- Good: "Provides the main character photo that will be composited into new scenes"
- Bad: "Image input"

**nodes[].suggestedTitle**: Short, descriptive title for the UI
- Good: "Character Photo", "Style Reference", "Background Scene"
- Bad: "Input 1", "Node", "Image"

**nodes[].suggestedPrompt**: For prompt nodes, write helpful starter text
- For minimal workflows: Brief placeholder like "Describe the scene transformation..."
- For detailed workflows: Complete example prompt

**nodes[].suggestedModel**: For nanoBanana nodes
- Use "nano-banana-pro" for high-quality final outputs
- Use "nano-banana" for intermediate processing or speed

**nodes[].suggestedSettings**: Optional settings for generation nodes
- aspectRatio: "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"

**connections[].description**: Explain the data flow
- Good: "Character photo provides the subject to maintain across generations"
- Bad: "Image connection"

**groups**: Only include if workflow has 4+ nodes, helps organize complex workflows
- colors: "neutral", "blue", "green", "purple", "orange"

**estimatedComplexity**:
- "simple": 2-4 nodes, straightforward linear flow
- "moderate": 5-8 nodes, some branching or multiple outputs
- "complex": 9+ nodes, parallel processing, multi-stage pipelines

**warnings**: Include if:
- User's request might have limitations
- Certain features aren't supported
- Results may vary based on input quality

## Example Proposal

For request "Create product photos with different backgrounds":

{
  "name": "Product Background Swap",
  "description": "Takes a product photo and places it in various background scenes. Upload your product image, then add different scene descriptions for each variation you want.",
  "nodes": [
    {
      "id": "node-1",
      "type": "imageInput",
      "purpose": "The main product photo that will be extracted and placed into new scenes",
      "suggestedTitle": "Product Photo"
    },
    {
      "id": "node-2",
      "type": "prompt",
      "purpose": "Describes the first background scene and how to integrate the product",
      "suggestedTitle": "Scene 1 Description",
      "suggestedPrompt": "Place the product on a modern white marble countertop with soft natural lighting from the left. Maintain product proportions and add subtle shadows."
    },
    {
      "id": "node-3",
      "type": "nanoBanana",
      "purpose": "Generates the product composited into the first scene",
      "suggestedTitle": "Generate Scene 1",
      "suggestedModel": "nano-banana-pro",
      "suggestedSettings": { "aspectRatio": "1:1" }
    }
  ],
  "connections": [
    {
      "from": "node-1",
      "to": "node-3",
      "type": "image",
      "description": "Product photo provides the subject to maintain across all scene variations"
    },
    {
      "from": "node-2",
      "to": "node-3",
      "type": "text",
      "description": "Scene description tells the AI how to composite the product"
    }
  ],
  "estimatedComplexity": "simple",
  "warnings": ["Best results with products on neutral backgrounds that can be easily separated"]
}

## User's Request
"${description}"

Generate a workflow proposal that best addresses this request. Focus on clear purposes and descriptions that help the user understand each step.

OUTPUT ONLY THE JSON:`;
}
