/**
 * All NodeSpec registrations.
 *
 * This file is the SINGLE place that knows about all node types.
 * Import and call registerAllNodeSpecs() once at app startup.
 *
 * To add a new node: add a new spec object here and call register().
 * Zero other files need to change.
 */

import { nodeSpecRegistry } from "./nodeRegistry";
import type { NodeSpec } from "./nodeSpec";

// ─── Foundation Core Nodes ────────────────────────────────────────────────────

const IMAGE_INPUT: NodeSpec = {
  type: "imageInput",
  displayName: "Image Input",
  category: "input",
  defaultData: {
    image: null,
    filename: null,
    dimensions: null,
    isOptional: false,
  },
  defaultDimensions: { width: 300, height: 280 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "image" },
  ],
  inputs: [],
  executor: "__passthrough__",
  minimapColor: "#3b82f6",
  isCore: true,
  packId: "agent1-foundation",
};

const AUDIO_INPUT: NodeSpec = {
  type: "audioInput",
  displayName: "Audio Input",
  category: "input",
  defaultData: {
    audioFile: null,
    filename: null,
    duration: null,
    format: null,
    isOptional: false,
  },
  defaultDimensions: { width: 300, height: 200 },
  outputs: [
    { handleId: "audio", dataType: "audio", extractFrom: "audioFile" },
  ],
  inputs: [
    { handleId: "audio", dataType: "audio", multiple: false, optional: true },
  ],
  executor: "executeAudioInput",
  minimapColor: "#a78bfa",
  isCore: true,
  packId: "agent1-foundation",
};

const VIDEO_INPUT: NodeSpec = {
  type: "videoInput",
  displayName: "Video Input",
  category: "input",
  defaultData: {
    video: null,
    videoRef: undefined,
    filename: null,
    duration: null,
    dimensions: null,
    format: null,
  },
  defaultDimensions: { width: 300, height: 240 },
  outputs: [
    { handleId: "video", dataType: "video", extractFrom: "video" },
  ],
  inputs: [
    { handleId: "video", dataType: "video", multiple: false, optional: true },
  ],
  executor: "executeVideoInput",
  minimapColor: "#14b8a6",
  isCore: true,
  packId: "agent1-foundation",
};

const ANNOTATION: NodeSpec = {
  type: "annotation",
  displayName: "Annotation",
  category: "processing",
  defaultData: {
    sourceImage: null,
    annotations: [],
    outputImage: null,
  },
  defaultDimensions: { width: 300, height: 280 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: true },
  ],
  executor: "executeAnnotation",
  minimapColor: "#8b5cf6",
  isCore: true,
  packId: "agent1-foundation",
};

const PROMPT: NodeSpec = {
  type: "prompt",
  displayName: "Prompt",
  category: "input",
  defaultData: {
    prompt: "",
    isOptional: false,
  },
  defaultDimensions: { width: 320, height: 220 },
  outputs: [
    { handleId: "text", dataType: "text", extractFrom: "prompt" },
  ],
  inputs: [],
  executor: "executePrompt",
  minimapColor: "#f97316",
  isCore: true,
  packId: "agent1-foundation",
};

const ARRAY: NodeSpec = {
  type: "array",
  displayName: "Array",
  category: "processing",
  defaultData: {
    inputText: null,
    splitMode: "delimiter",
    delimiter: "*",
    regexPattern: "",
    trimItems: true,
    removeEmpty: true,
    selectedOutputIndex: null,
    outputItems: [],
    outputText: "[]",
    error: null,
    batchMode: false,
  },
  defaultDimensions: { width: 340, height: 260 },
  outputs: [
    { handleId: "text", dataType: "text", extractFrom: "outputText" },
  ],
  inputs: [
    { handleId: "text", dataType: "text", multiple: false, optional: true },
  ],
  executor: "executeArray",
  minimapColor: "#a3e635",
  isCore: true,
  packId: "agent1-foundation",
};

const PROMPT_CONSTRUCTOR: NodeSpec = {
  type: "promptConstructor",
  displayName: "Prompt Constructor",
  category: "processing",
  defaultData: {
    template: "",
    outputText: null,
    unresolvedVars: [],
  },
  defaultDimensions: { width: 340, height: 280 },
  outputs: [
    { handleId: "text", dataType: "text", extractFrom: "outputText" },
  ],
  inputs: [
    { handleId: "text", dataType: "text", multiple: true, optional: true },
  ],
  executor: "executePromptConstructor",
  minimapColor: "#f472b6",
  isCore: true,
  packId: "agent1-foundation",
};

const NANO_BANANA: NodeSpec = {
  type: "nanoBanana",
  displayName: "Generate Image",
  category: "generation",
  // Static fallback — actual defaults merge localStorage at runtime
  defaultData: {
    inputImages: [],
    inputPrompt: null,
    outputImage: null,
    aspectRatio: "1:1",
    resolution: "1K",
    model: "nano-banana",
    selectedModel: null,
    useGoogleSearch: false,
    useImageSearch: false,
    status: "idle",
    error: null,
    imageHistory: [],
    selectedHistoryIndex: 0,
  },
  defaultDimensions: { width: 300, height: 300 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: false },
  ],
  executor: "executeNanoBanana",
  minimapColor: "#22c55e",
  isCore: true,
  packId: "agent1-foundation",
};

const GENERATE_VIDEO: NodeSpec = {
  type: "generateVideo",
  displayName: "Generate Video",
  category: "generation",
  defaultData: {
    inputImages: [],
    inputPrompt: null,
    outputVideo: null,
    selectedModel: undefined,
    status: "idle",
    error: null,
    videoHistory: [],
    selectedVideoHistoryIndex: 0,
  },
  defaultDimensions: { width: 300, height: 300 },
  outputs: [
    { handleId: "video", dataType: "video", extractFrom: "outputVideo" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: false },
    { handleId: "video", dataType: "video", multiple: false, optional: true },
  ],
  connectionRules: {
    // video output allowed targets handled in isValidConnection
    allowedTargetNodeTypes: ["generateVideo", "videoStitch", "easeCurve", "videoTrim", "videoFrameGrab", "output", "router"],
  },
  executor: "executeGenerateVideo",
  minimapColor: "#9333ea",
  isCore: true,
  packId: "agent1-foundation",
};

const GENERATE_3D: NodeSpec = {
  type: "generate3d",
  displayName: "Generate 3D",
  category: "generation",
  defaultData: {
    inputImages: [],
    inputPrompt: null,
    output3dUrl: null,
    savedFilename: null,
    savedFilePath: null,
    selectedModel: undefined,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 300, height: 300 },
  outputs: [
    { handleId: "3d", dataType: "3d", extractFrom: "output3dUrl" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: true },
  ],
  executor: "executeGenerate3D",
  minimapColor: "#fb923c",
  isCore: true,
  packId: "agent1-foundation",
};

const GENERATE_AUDIO: NodeSpec = {
  type: "generateAudio",
  displayName: "Generate Audio",
  category: "generation",
  defaultData: {
    inputPrompt: null,
    outputAudio: null,
    selectedModel: undefined,
    status: "idle",
    error: null,
    audioHistory: [],
    selectedAudioHistoryIndex: 0,
    duration: null,
    format: null,
  },
  defaultDimensions: { width: 300, height: 280 },
  outputs: [
    { handleId: "audio", dataType: "audio", extractFrom: "outputAudio" },
  ],
  inputs: [
    { handleId: "text", dataType: "text", multiple: false, optional: false },
  ],
  executor: "executeGenerateAudio",
  minimapColor: "#d946ef",
  isCore: true,
  packId: "agent1-foundation",
};

const LLM_GENERATE: NodeSpec = {
  type: "llmGenerate",
  displayName: "LLM",
  category: "generation",
  defaultData: {
    inputPrompt: null,
    inputImages: [],
    outputText: null,
    provider: "google",
    model: "gemini-3.1-pro-preview",
    temperature: 0.7,
    maxTokens: 8192,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 320, height: 360 },
  outputs: [
    { handleId: "text", dataType: "text", extractFrom: "outputText" },
  ],
  inputs: [
    { handleId: "text", dataType: "text", multiple: false, optional: true },
    { handleId: "image", dataType: "image", multiple: true, optional: true },
  ],
  executor: "executeLlmGenerate",
  minimapColor: "#06b6d4",
  isCore: true,
  packId: "agent1-foundation",
};

const SPLIT_GRID: NodeSpec = {
  type: "splitGrid",
  displayName: "Split Grid",
  category: "processing",
  defaultData: {
    sourceImage: null,
    targetCount: 6,
    defaultPrompt: "",
    generateSettings: {
      aspectRatio: "1:1",
      resolution: "1K",
      model: "nano-banana-pro",
      useGoogleSearch: false,
      useImageSearch: false,
    },
    childNodeIds: [],
    gridRows: 2,
    gridCols: 3,
    isConfigured: false,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 300, height: 320 },
  outputs: [],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: false },
  ],
  executor: "executeSplitGrid",
  minimapColor: "#f59e0b",
  isCore: true,
  packId: "agent1-foundation",
};

const OUTPUT: NodeSpec = {
  type: "output",
  displayName: "Output",
  category: "output",
  defaultData: {
    image: null,
    outputFilename: "",
  },
  defaultDimensions: { width: 320, height: 320 },
  outputs: [],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: false },
  ],
  connectionRules: {
    // Output node accepts video despite its handle being typed as "image"
    acceptsAnySourceType: false, // handled in isValidConnection
  },
  executor: "executeOutput",
  minimapColor: "#ef4444",
  isCore: true,
  packId: "agent1-foundation",
};

const OUTPUT_GALLERY: NodeSpec = {
  type: "outputGallery",
  displayName: "Output Gallery",
  category: "output",
  defaultData: {
    images: [],
  },
  defaultDimensions: { width: 320, height: 360 },
  outputs: [],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: false },
  ],
  executor: "executeOutputGallery",
  minimapColor: "#ec4899",
  isCore: true,
  packId: "agent1-foundation",
};

const IMAGE_COMPARE: NodeSpec = {
  type: "imageCompare",
  displayName: "Image Compare",
  category: "utility",
  defaultData: {
    imageA: null,
    imageB: null,
  },
  defaultDimensions: { width: 400, height: 360 },
  outputs: [],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: false },
  ],
  executor: "executeImageCompare",
  minimapColor: "#14b8a6",
  isCore: true,
  packId: "agent1-foundation",
};

const VIDEO_STITCH: NodeSpec = {
  type: "videoStitch",
  displayName: "Video Stitch",
  category: "processing",
  defaultData: {
    clips: [],
    clipOrder: [],
    outputVideo: null,
    loopCount: 1,
    status: "idle",
    error: null,
    progress: 0,
    encoderSupported: null,
  },
  defaultDimensions: { width: 400, height: 280 },
  outputs: [
    { handleId: "video", dataType: "video", extractFrom: "outputVideo" },
  ],
  inputs: [
    { handleId: "video", dataType: "video", multiple: true, optional: false },
  ],
  executor: "executeVideoStitch",
  minimapColor: "#f97316",
  isCore: true,
  packId: "agent1-foundation",
};

const EASE_CURVE: NodeSpec = {
  type: "easeCurve",
  displayName: "Ease Curve",
  category: "processing",
  defaultData: {
    bezierHandles: [0.445, 0.05, 0.55, 0.95],
    easingPreset: "easeInOutSine",
    inheritedFrom: null,
    outputDuration: 1.5,
    outputVideo: null,
    status: "idle",
    error: null,
    progress: 0,
    encoderSupported: null,
  },
  defaultDimensions: { width: 340, height: 480 },
  outputs: [
    { handleId: "easeCurve", dataType: "easeCurve", extractFrom: "outputVideo" },
    { handleId: "video", dataType: "video", extractFrom: "outputVideo" },
  ],
  inputs: [
    { handleId: "easeCurve", dataType: "easeCurve", multiple: false, optional: true },
    { handleId: "video", dataType: "video", multiple: false, optional: false },
  ],
  executor: "executeEaseCurve",
  minimapColor: "#bef264",
  isCore: true,
  packId: "agent1-foundation",
};

const VIDEO_TRIM: NodeSpec = {
  type: "videoTrim",
  displayName: "Video Trim",
  category: "processing",
  defaultData: {
    startTime: 0,
    endTime: 0,
    duration: null,
    outputVideo: null,
    status: "idle",
    error: null,
    progress: 0,
    encoderSupported: null,
  },
  defaultDimensions: { width: 360, height: 360 },
  outputs: [
    { handleId: "video", dataType: "video", extractFrom: "outputVideo" },
  ],
  inputs: [
    { handleId: "video", dataType: "video", multiple: false, optional: false },
  ],
  executor: "executeVideoTrim",
  minimapColor: "#60a5fa",
  isCore: true,
  packId: "agent1-foundation",
};

const VIDEO_FRAME_GRAB: NodeSpec = {
  type: "videoFrameGrab",
  displayName: "Video Frame Grab",
  category: "processing",
  defaultData: {
    framePosition: "first",
    outputImage: null,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 320, height: 320 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "video", dataType: "video", multiple: false, optional: false },
  ],
  executor: "executeVideoFrameGrab",
  minimapColor: "#38bdf8",
  isCore: true,
  packId: "agent1-foundation",
};

const ROUTER: NodeSpec = {
  type: "router",
  displayName: "Router",
  category: "logic",
  defaultData: {},
  defaultDimensions: { width: 200, height: 80 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "", passthrough: true },
    { handleId: "text", dataType: "text", extractFrom: "", passthrough: true },
    { handleId: "video", dataType: "video", extractFrom: "", passthrough: true },
    { handleId: "audio", dataType: "audio", extractFrom: "", passthrough: true },
    { handleId: "3d", dataType: "3d", extractFrom: "", passthrough: true },
    { handleId: "easeCurve", dataType: "easeCurve", extractFrom: "", passthrough: true },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: true, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: true },
    { handleId: "video", dataType: "video", multiple: true, optional: true },
    { handleId: "audio", dataType: "audio", multiple: false, optional: true },
    { handleId: "3d", dataType: "3d", multiple: false, optional: true },
    { handleId: "easeCurve", dataType: "easeCurve", multiple: false, optional: true },
  ],
  connectionRules: {
    acceptsAnySourceType: true,
    dynamicOutputType: true,
  },
  executor: "executeRouter",
  minimapColor: "#6b7280",
  isCore: true,
  packId: "agent1-foundation",
};

const SWITCH: NodeSpec = {
  type: "switch",
  displayName: "Switch",
  category: "logic",
  defaultData: {
    inputType: null,
    switches: [
      { id: "__placeholder__", name: "Output 1", enabled: true },
    ],
  },
  defaultDimensions: { width: 220, height: 120 },
  outputs: [
    // Dynamic — actual handles are generated per switch entry at runtime
    { handleId: "switch-output", dataType: "image", extractFrom: "", passthrough: true },
  ],
  inputs: [
    { handleId: "generic-input", dataType: "image", multiple: false, optional: false },
  ],
  connectionRules: {
    acceptsAnySourceType: true,
    dynamicOutputType: true,
  },
  executor: "executeSwitch",
  minimapColor: "#8b5cf6",
  isCore: true,
  packId: "agent1-foundation",
};

const CONDITIONAL_SWITCH: NodeSpec = {
  type: "conditionalSwitch",
  displayName: "Conditional Switch",
  category: "logic",
  defaultData: {
    incomingText: null,
    rules: [
      {
        id: "__placeholder__",
        value: "",
        mode: "contains",
        label: "Rule 1",
        isMatched: false,
      },
    ],
  },
  defaultDimensions: { width: 260, height: 180 },
  outputs: [
    // Dynamic — one handle per rule + default
    { handleId: "text", dataType: "text", extractFrom: "", passthrough: true },
  ],
  inputs: [
    { handleId: "text", dataType: "text", multiple: false, optional: false },
  ],
  connectionRules: {
    // Input only accepts text; output only produces text
    allowedTargetNodeTypes: [], // populated dynamically - downstream must accept text
  },
  executor: "executeConditionalSwitch",
  minimapColor: "#06b6d4",
  isCore: true,
  packId: "agent1-foundation",
};

const GLB_VIEWER: NodeSpec = {
  type: "glbViewer",
  displayName: "3D Viewer",
  category: "input",
  defaultData: {
    glbUrl: null,
    filename: null,
    capturedImage: null,
  },
  defaultDimensions: { width: 360, height: 380 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "capturedImage" },
  ],
  inputs: [
    { handleId: "3d", dataType: "3d", multiple: false, optional: true },
  ],
  executor: "executeGlbViewer",
  minimapColor: "#0ea5e9",
  isCore: true,
  packId: "agent1-foundation",
};

// ─── Foundation Utility Nodes ─────────────────────────────────────────────────

const PREVIEW_IMAGE: NodeSpec = {
  type: "previewImage",
  displayName: "Preview Image",
  category: "utility",
  defaultData: {
    image: null,
    label: "",
  },
  defaultDimensions: { width: 320, height: 320 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "image" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: true },
  ],
  executor: "__noop__",
  minimapColor: "#94a3b8",
  isCore: true,
  packId: "agent1-foundation",
};

const SHOW_ANYTHING: NodeSpec = {
  type: "showAnything",
  displayName: "Show Anything",
  category: "utility",
  defaultData: {
    content: null,
    contentType: "unknown",
  },
  defaultDimensions: { width: 380, height: 300 },
  outputs: [
    // Type is dynamic based on contentType — handled in getSourceOutput
    { handleId: "image", dataType: "image", extractFrom: "content" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: true },
  ],
  connectionRules: {
    acceptsAnySourceType: true,
  },
  executor: "__noop__",
  minimapColor: "#94a3b8",
  isCore: true,
  packId: "agent1-foundation",
};

// ─── Neural Atelier Pack ───────────────────────────────────────────────────────

const NA_SKETCH_TO_PHOTO: NodeSpec = {
  type: "naSketchToPhoto",
  displayName: "NA: Sketch to Photo",
  category: "generation",
  defaultData: {
    promptProfile: "01_Sketch_to_Photo",
    briefText: "",
    imageModel: "nano-banana-pro",
    aspectRatio: "1:1",
    resolution: "1K",
    topP: 0.95,
    outputImage: null,
    log: null,
    flashRequestJson: null,
    nanoBananaRequestJson: null,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 340, height: 520 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: true },
    { handleId: "text", dataType: "text", multiple: false, optional: true },
  ],
  executor: "executeNASketchToPhoto",
  minimapColor: "#94a3b8",
  isCore: false,
  packId: "agent1_neural_atelier",
};

const NA_STYLING_DETAIL: NodeSpec = {
  type: "naStylingDetail",
  displayName: "NA: Styling Detail",
  category: "generation",
  defaultData: {
    garmentType: "",
    detailCategory: "",
    detailOption: "",
    description: "",
    brief: "",
    imageModel: "nano-banana-pro",
    aspectRatio: "1:1",
    resolution: "1K",
    topP: 0.95,
    outputImage: null,
    prompt: null,
    log: null,
    outputJson: null,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 340, height: 560 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: true },
  ],
  executor: "executeNAStylingDetail",
  minimapColor: "#94a3b8",
  isCore: false,
  packId: "agent1_neural_atelier",
};

const NA_RECOLOR: NodeSpec = {
  type: "naRecolor",
  displayName: "NA: Recolor",
  category: "generation",
  defaultData: {
    pantoneColorCurated: "-- Select a Pantone color --",
    pantoneColor: "-- Select a Pantone color --",
    brief: "",
    imageModel: "nano-banana-pro",
    aspectRatio: "1:1",
    resolution: "1K",
    topP: 0.95,
    outputImage: null,
    prompt: null,
    log: null,
    outputJson: null,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 340, height: 480 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
  ],
  inputs: [
    { handleId: "image", dataType: "image", multiple: false, optional: false },
  ],
  executor: "executeNARecolor",
  minimapColor: "#94a3b8",
  isCore: false,
  packId: "agent1_neural_atelier",
};

// ─── Morpheus Pack ────────────────────────────────────────────────────────────

const MORPHEUS_MODEL_MANAGEMENT: NodeSpec = {
  type: "morpheusModelManagement",
  displayName: "Morpheus Model Management",
  category: "input",
  defaultData: {
    selectedTalentId: null,
    selectedTalentName: null,
    selectedTalentImage: null,
    selectedTalentDescription: null,
    selectedTalentTags: [],
    filters: {
      name: "",
      tags: "",
      tagLogic: "OR",
      gender: "",
      age_group: "",
      ethnicity: "",
      favoritesOnly: false,
    },
    currentPage: 1,
    patreonAuthenticated: false,
    patreonUserName: null,
    patreonDeviceId: null,
    variableName: undefined,
    outputImage: null,
    outputDescription: null,
    outputMetadata: null,
    status: "idle",
    error: null,
  },
  defaultDimensions: { width: 560, height: 720 },
  outputs: [
    { handleId: "image", dataType: "image", extractFrom: "outputImage" },
    { handleId: "description", dataType: "text", extractFrom: "outputDescription" },
    { handleId: "metadata", dataType: "text", extractFrom: "outputMetadata" },
  ],
  inputs: [],
  executor: "executeMorpheusModelManagement",
  minimapColor: "#94a3b8",
  isCore: false,
  packId: "morpheus-model-management",
};

// ─── Registration ─────────────────────────────────────────────────────────────

const ALL_SPECS: NodeSpec[] = [
  // Foundation — Input
  IMAGE_INPUT,
  AUDIO_INPUT,
  VIDEO_INPUT,
  ANNOTATION,
  PROMPT,
  GLB_VIEWER,

  // Foundation — Processing
  ARRAY,
  PROMPT_CONSTRUCTOR,
  SPLIT_GRID,
  VIDEO_STITCH,
  EASE_CURVE,
  VIDEO_TRIM,
  VIDEO_FRAME_GRAB,

  // Foundation — Generation
  NANO_BANANA,
  GENERATE_VIDEO,
  GENERATE_3D,
  GENERATE_AUDIO,
  LLM_GENERATE,

  // Foundation — Output
  OUTPUT,
  OUTPUT_GALLERY,
  IMAGE_COMPARE,

  // Foundation — Logic
  ROUTER,
  SWITCH,
  CONDITIONAL_SWITCH,

  // Foundation — Utility
  PREVIEW_IMAGE,
  SHOW_ANYTHING,

  // Neural Atelier pack
  NA_SKETCH_TO_PHOTO,
  NA_STYLING_DETAIL,
  NA_RECOLOR,

  // Morpheus pack
  MORPHEUS_MODEL_MANAGEMENT,
];

/**
 * Register all node specs with the global registry.
 * Call once at application startup (e.g. in workflowStore initialization).
 *
 * Safe to call multiple times — subsequent calls overwrite existing specs.
 */
export function registerAllNodeSpecs(): void {
  nodeSpecRegistry.registerAll(ALL_SPECS);
}

/**
 * Returns the total number of registered specs.
 * Used for testing / diagnostics.
 */
export function getRegisteredSpecCount(): number {
  return ALL_SPECS.length;
}

export { ALL_SPECS };
