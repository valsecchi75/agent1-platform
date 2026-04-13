/**
 * Export all preset templates from templates.ts to individual JSON files
 * in public/workflows/ folder.
 *
 * Run: node scripts/export-templates.js
 *
 * This creates one .json file per preset template, with the same structure
 * the TemplateExplorerView expects from the /api/community-workflows endpoint.
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.resolve(__dirname, '..', 'public', 'workflows');

// Ensure dir exists
if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

// ── Node data factories (matching templates.ts) ──

const createImageInputData = (imageUrl = null, filename = null) => ({
  image: imageUrl,
  filename: filename,
  dimensions: imageUrl ? { width: 800, height: 600 } : null,
});

const createPromptData = (prompt = "") => ({ prompt });

const createNanoBananaData = () => ({
  inputImages: [],
  inputPrompt: null,
  outputImage: null,
  aspectRatio: "1:1",
  resolution: "1K",
  model: "nano-banana-2",
  useGoogleSearch: false,
  useImageSearch: false,
  status: "idle",
  error: null,
  imageHistory: [],
  selectedHistoryIndex: -1,
});

const createLLMData = (prompt = "") => ({
  inputPrompt: prompt,
  inputImages: [],
  outputText: null,
  provider: "google",
  model: "gemini-3-flash",
  temperature: 0.7,
  maxTokens: 1024,
  status: "idle",
  error: null,
});

const createOutputData = () => ({ image: null });

const NODE_DIMENSIONS = {
  imageInput: { width: 300, height: 280 },
  annotation: { width: 300, height: 280 },
  prompt: { width: 320, height: 220 },
  nanoBanana: { width: 300, height: 300 },
  llmGenerate: { width: 320, height: 360 },
  output: { width: 320, height: 320 },
};

// ── All preset templates ──

const PRESET_TEMPLATES = [
  {
    id: "product-shot",
    name: "Product Shot",
    description: "Place product in a new scene or environment",
    category: "simple",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Product Shot",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 100 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-2", type: "imageInput", position: { x: 50, y: 430 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 760 }, data: createPromptData(""), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 300 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 290 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "imageInput-2", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e3", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e4", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
  {
    id: "model-product",
    name: "Model + Product",
    description: "Combine model, product, and scene in one generation",
    category: "simple",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Model + Product",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 50 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-2", type: "imageInput", position: { x: 50, y: 380 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-3", type: "imageInput", position: { x: 50, y: 710 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 1040 }, data: createPromptData(""), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 400 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 390 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "imageInput-2", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e3", source: "imageInput-3", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e4", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e5", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
  {
    id: "color-variations",
    name: "Color Variations",
    description: "Generate multiple color variants of a product",
    category: "simple",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Color Variations",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 200 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 530 }, data: createPromptData("Change the color to red"), style: NODE_DIMENSIONS.prompt },
        { id: "prompt-2", type: "prompt", position: { x: 50, y: 800 }, data: createPromptData("Change the color to blue"), style: NODE_DIMENSIONS.prompt },
        { id: "prompt-3", type: "prompt", position: { x: 50, y: 1070 }, data: createPromptData("Change the color to green"), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 100 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "nanoBanana-2", type: "nanoBanana", position: { x: 450, y: 450 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "nanoBanana-3", type: "nanoBanana", position: { x: 450, y: 800 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 100 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
        { id: "output-2", type: "output", position: { x: 850, y: 450 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
        { id: "output-3", type: "output", position: { x: 850, y: 800 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-2", targetHandle: "image" },
        { id: "e3", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-3", targetHandle: "image" },
        { id: "e4", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e5", source: "prompt-2", sourceHandle: "text", target: "nanoBanana-2", targetHandle: "text" },
        { id: "e6", source: "prompt-3", sourceHandle: "text", target: "nanoBanana-3", targetHandle: "text" },
        { id: "e7", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
        { id: "e8", source: "nanoBanana-2", sourceHandle: "image", target: "output-2", targetHandle: "image" },
        { id: "e9", source: "nanoBanana-3", sourceHandle: "image", target: "output-3", targetHandle: "image" },
      ],
    },
  },
  {
    id: "background-swap",
    name: "Background Swap",
    description: "Replace image background with a new scene",
    category: "simple",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Background Swap",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 150 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 480 }, data: createPromptData("Replace the background with a luxury studio setting"), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 250 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 240 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e3", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
  {
    id: "style-transfer",
    name: "Style Transfer",
    description: "Apply the style of one image to another",
    category: "simple",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Style Transfer",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 100 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-2", type: "imageInput", position: { x: 50, y: 430 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 760 }, data: createPromptData("Apply the style of the second image to the first image"), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 300 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 290 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "imageInput-2", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e3", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e4", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
  {
    id: "scene-composite",
    name: "Scene Composite",
    description: "Combine multiple elements into a composed scene",
    category: "advanced",
    tags: ["Gemini"],
    workflow: {
      version: 1,
      name: "Scene Composite",
      edgeStyle: "curved",
      nodes: [
        { id: "imageInput-1", type: "imageInput", position: { x: 50, y: 50 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-2", type: "imageInput", position: { x: 50, y: 380 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "imageInput-3", type: "imageInput", position: { x: 50, y: 710 }, data: createImageInputData(), style: NODE_DIMENSIONS.imageInput },
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 1040 }, data: createPromptData("Combine these elements into a cohesive editorial scene"), style: NODE_DIMENSIONS.prompt },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 450, y: 400 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 850, y: 390 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "imageInput-1", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e2", source: "imageInput-2", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e3", source: "imageInput-3", sourceHandle: "image", target: "nanoBanana-1", targetHandle: "image" },
        { id: "e4", source: "prompt-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e5", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
  {
    id: "llm-prompt-generation",
    name: "LLM Prompt Generation",
    description: "Use Gemini to write the prompt, then generate image",
    category: "advanced",
    tags: ["Gemini", "LLM"],
    workflow: {
      version: 1,
      name: "LLM Prompt Generation",
      edgeStyle: "curved",
      nodes: [
        { id: "prompt-1", type: "prompt", position: { x: 50, y: 150 }, data: createPromptData("Write a detailed editorial prompt for a luxury eyewear product shot"), style: NODE_DIMENSIONS.prompt },
        { id: "llm-1", type: "llmGenerate", position: { x: 450, y: 100 }, data: createLLMData(), style: NODE_DIMENSIONS.llmGenerate },
        { id: "nanoBanana-1", type: "nanoBanana", position: { x: 850, y: 150 }, data: createNanoBananaData(), style: NODE_DIMENSIONS.nanoBanana },
        { id: "output-1", type: "output", position: { x: 1250, y: 140 }, data: createOutputData(), style: NODE_DIMENSIONS.output },
      ],
      edges: [
        { id: "e1", source: "prompt-1", sourceHandle: "text", target: "llm-1", targetHandle: "text" },
        { id: "e2", source: "llm-1", sourceHandle: "text", target: "nanoBanana-1", targetHandle: "text" },
        { id: "e3", source: "nanoBanana-1", sourceHandle: "image", target: "output-1", targetHandle: "image" },
      ],
    },
  },
];

// ── Export each template ──

let count = 0;
for (const template of PRESET_TEMPLATES) {
  const filename = `${template.id}.json`;
  const filePath = path.join(WORKFLOWS_DIR, filename);

  const output = {
    ...template.workflow,
    // Add metadata for the listing API
    description: template.description,
    category: template.category,
    tags: template.tags,
    author: "AGENT 1 Preset",
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  count++;
  console.log(`  Exported: ${filename} (${template.name})`);
}

console.log(`\nDone — ${count} templates exported to public/workflows/`);
