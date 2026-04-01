"use client";

import { Node } from "@xyflow/react";
import { ExternalLink, Play, Check, X } from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ModelParameters } from "./ModelParameters";
import { CubicBezierEditor } from "@/components/CubicBezierEditor";
import { ModelSearchDialog } from "@/components/modals/ModelSearchDialog";
import { useInlineParameters } from "@/hooks/useInlineParameters";
import { getAllEasingNames, getEasingFunction } from "@/lib/easing-functions";
import { EASING_PRESETS, getPresetBezier, getEasingBezier } from "@/lib/easing-presets";
import { ProviderModel, ModelCapability } from "@/lib/providers/types";
import { evaluateRule } from "@/store/utils/ruleEvaluation";
import { useWorkflowStore, saveNanoBananaDefaults, useProviderApiKeys } from "@/store/workflowStore";
import { NodeType, NanoBananaNodeData, LLMGenerateNodeData, GenerateVideoNodeData, Generate3DNodeData, GenerateAudioNodeData, EaseCurveNodeData, ConditionalSwitchNodeData, AspectRatio, Resolution, ModelType, MODEL_DISPLAY_NAMES, ProviderType, SelectedModel, LLMProvider, LLMModelType, MatchMode, ConditionalSwitchRule } from "@/types";
import { NASketchToPhotoData, NAStylingDetailData, NARecolorData, NA_IMAGE_MODELS, NA_ASPECT_RATIOS, NA_RESOLUTIONS } from "@/types/customNodes";
import { deduplicatedFetch } from "@/utils/deduplicatedFetch";
import { getModelPageUrl, getProviderDisplayName } from "@/utils/providerUrls";

// List of node types that have configurable parameters
const CONFIGURABLE_NODE_TYPES: NodeType[] = [
  "nanoBanana",
  "generateVideo",
  "generate3d",
  "generateAudio",
  "llmGenerate",
  "easeCurve",
  "conditionalSwitch",
  // Neural Atelier custom nodes
  "naSketchToPhoto",
  "naStylingDetail",
  "naRecolor",
];

// Generation node types that can use inline parameters
const GENERATION_NODE_TYPES: NodeType[] = [
  "nanoBanana",
  "generateVideo",
  "generate3d",
  "generateAudio",
  "llmGenerate",
];

// Base 10 aspect ratios (all Gemini image models)
const BASE_ASPECT_RATIOS: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

// Extended 14 aspect ratios (Nano Banana 2 adds extreme ratios)
const EXTENDED_ASPECT_RATIOS: AspectRatio[] = ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];

// Resolutions per model
const RESOLUTIONS_PRO: Resolution[] = ["1K", "2K", "4K"];
const RESOLUTIONS_NB2: Resolution[] = ["512", "1K", "2K", "4K"];

// Hardcoded Gemini image models
const GEMINI_IMAGE_MODELS: { value: ModelType; label: string }[] = [
  { value: "nano-banana", label: "Nano Banana" },
  { value: "nano-banana-2", label: "Nano Banana 2" },
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
];

// LLM providers and models
const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const LLM_MODELS: Record<LLMProvider, { value: LLMModelType; label: string }[]> = {
  google: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
  anthropic: [
    { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4.6", label: "Claude Opus 4.6" },
  ],
};

// Image/video/audio/3d generation capabilities
const IMAGE_CAPABILITIES: ModelCapability[] = ["text-to-image", "image-to-image"];
const VIDEO_CAPABILITIES: ModelCapability[] = ["text-to-video", "image-to-video"];
const AUDIO_CAPABILITIES: ModelCapability[] = ["text-to-audio"];
const MODEL_3D_CAPABILITIES: ModelCapability[] = ["text-to-3d", "image-to-3d"];

// Easing names
const ALL_EASING_NAMES = getAllEasingNames();
const PRESET_NAMES = new Set(EASING_PRESETS);

// Generate SVG polyline for easing preview
function generateEasingPolyline(
  easingName: string,
  width: number,
  height: number,
  samples: number = 20
): string {
  const fn = getEasingFunction(easingName);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const y = fn(t);
    return `${(t * width).toFixed(1)},${((1 - y) * height).toFixed(1)}`;
  }).join(" ");
}

/**
 * Fixed-position control panel on the right side of viewport
 * Displays controls for the currently selected node
 */
export function ControlPanel() {
  const selectedNode = useWorkflowStore((state) => {
    const selected = state.nodes.filter((n) => n.selected);
    return selected.length === 1 ? selected[0] : null;
  });
  const { inlineParametersEnabled } = useInlineParameters();

  // Check if the selected node is configurable
  const isConfigurable = selectedNode && CONFIGURABLE_NODE_TYPES.includes(selectedNode.type as NodeType);

  // If no single node selected or not configurable, hide panel
  if (!selectedNode || !isConfigurable) {
    return null;
  }

  // Check if this is a generation node
  const isGenerationNode = selectedNode &&
    GENERATION_NODE_TYPES.includes(selectedNode.type as NodeType);

  // Hide for generation nodes when inline parameters enabled
  if (isGenerationNode && inlineParametersEnabled) {
    return null;
  }

  return (
    <div className="fixed top-0 right-6 h-screen z-[90] flex items-center pointer-events-none">
      <div
        className="w-80 bg-neutral-800 border border-neutral-700 rounded-xl max-h-[80vh] overflow-y-auto pointer-events-auto transition-opacity duration-200 nowheel"
        style={{
          boxShadow: [
            '-1px 0 2px rgba(0,0,0,0.18)',
            '-2px 0 4px rgba(0,0,0,0.15)',
            '-4px 0 8px rgba(0,0,0,0.12)',
            '-8px 0 16px rgba(0,0,0,0.10)',
            '-16px 0 32px rgba(0,0,0,0.08)',
            '-32px 0 64px rgba(0,0,0,0.06)',
          ].join(', '),
        }}
      >
        <div className="p-4">
          {/* Header */}
          <h3 className="text-sm font-medium text-neutral-200">
            {getNodeTypeTitle(selectedNode.type as NodeType)}
          </h3>

          {/* Node-specific controls */}
          <div className="space-y-4 mt-4">
            {selectedNode.type === "nanoBanana" && (
              <GenerateImageControls node={selectedNode} />
            )}
            {selectedNode.type === "generateVideo" && (
              <GenerateVideoControls node={selectedNode} />
            )}
            {selectedNode.type === "generate3d" && (
              <Generate3DControls node={selectedNode} />
            )}
            {selectedNode.type === "generateAudio" && (
              <GenerateAudioControls node={selectedNode} />
            )}
            {selectedNode.type === "llmGenerate" && (
              <LLMControls node={selectedNode} />
            )}
            {selectedNode.type === "easeCurve" && (
              <EaseCurveControls node={selectedNode} />
            )}
            {selectedNode.type === "conditionalSwitch" && (
              <ConditionalSwitchControls node={selectedNode} />
            )}
            {selectedNode.type === "naSketchToPhoto" && (
              <NASketchToPhotoControls node={selectedNode} />
            )}
            {selectedNode.type === "naStylingDetail" && (
              <NAStylingDetailControls node={selectedNode} />
            )}
            {selectedNode.type === "naRecolor" && (
              <NARecolorControls node={selectedNode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getNodeTypeTitle(type: NodeType): string {
  const titles: Record<string, string> = {
    nanoBanana: "Generate Image Settings",
    generateVideo: "Generate Video Settings",
    generate3d: "Generate 3D Settings",
    generateAudio: "Generate Audio Settings",
    llmGenerate: "LLM Settings",
    easeCurve: "Ease Curve Settings",
    conditionalSwitch: "Conditional Switch Settings",
    naSketchToPhoto: "NA — Sketch to Photo",
    naStylingDetail: "NA — Styling Detail Change",
    naRecolor: "NA — Recolor",
  };
  return titles[type] || "Settings";
}

// Generate Image Controls
function GenerateImageControls({ node }: { node: Node }) {
  const nodeData = node.data as NanoBananaNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const { replicateApiKey, falApiKey, kieApiKey, replicateEnabled, kieEnabled } = useProviderApiKeys();
  const [externalModels, setExternalModels] = useState<ProviderModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsFetchError, setModelsFetchError] = useState<string | null>(null);
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);

  const currentProvider: ProviderType = nodeData.selectedModel?.provider || "gemini";

  // Get enabled providers
  const enabledProviders = useMemo(() => {
    const providers: { id: ProviderType; name: string }[] = [];
    providers.push({ id: "gemini", name: "Gemini" });
    providers.push({ id: "fal", name: "fal.ai" });
    if (replicateEnabled && replicateApiKey) {
      providers.push({ id: "replicate", name: "Replicate" });
    }
    if (kieEnabled && kieApiKey) {
      providers.push({ id: "kie", name: "Kie.ai" });
    }
    return providers;
  }, [replicateEnabled, replicateApiKey, kieEnabled, kieApiKey]);

  // Fetch models from external providers
  const fetchModels = useCallback(async () => {
    if (currentProvider === "gemini") {
      setExternalModels([]);
      setModelsFetchError(null);
      return;
    }

    setIsLoadingModels(true);
    setModelsFetchError(null);
    try {
      const capabilities = IMAGE_CAPABILITIES.join(",");
      const headers: HeadersInit = {};
      switch (currentProvider) {
        case "replicate":
          if (replicateApiKey) headers["X-Replicate-Key"] = replicateApiKey;
          break;
        case "fal":
          if (falApiKey) headers["X-Fal-Key"] = falApiKey;
          break;
        case "kie":
          if (kieApiKey) headers["X-Kie-Key"] = kieApiKey;
          break;
      }

      const response = await deduplicatedFetch(`/api/models?provider=${currentProvider}&capabilities=${capabilities}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setExternalModels(data.models || []);
        setModelsFetchError(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Failed to load models (${response.status})`;
        setExternalModels([]);
        setModelsFetchError(errorMsg);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setExternalModels([]);
      setModelsFetchError("Failed to load models. Check your connection.");
    } finally {
      setIsLoadingModels(false);
    }
  }, [currentProvider, replicateApiKey, falApiKey, kieApiKey]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const provider = e.target.value as ProviderType;

      if (provider === "gemini") {
        const newSelectedModel: SelectedModel = {
          provider: "gemini",
          modelId: nodeData.model || "nano-banana-pro",
          displayName: GEMINI_IMAGE_MODELS.find(m => m.value === (nodeData.model || "nano-banana-pro"))?.label || "Nano Banana Pro",
        };
        updateNodeData(node.id, { selectedModel: newSelectedModel, parameters: {} });
      } else {
        const newSelectedModel: SelectedModel = {
          provider,
          modelId: "",
          displayName: "Select model...",
        };
        updateNodeData(node.id, { selectedModel: newSelectedModel, parameters: {} });
      }
    },
    [node.id, nodeData.model, updateNodeData]
  );

  const handleExternalModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const modelId = e.target.value;
      const model = externalModels.find(m => m.id === modelId);
      if (model) {
        const newSelectedModel: SelectedModel = {
          provider: currentProvider,
          modelId: model.id,
          displayName: model.name,
          capabilities: model.capabilities,
        };
        updateNodeData(node.id, { selectedModel: newSelectedModel, parameters: {} });
      }
    },
    [node.id, currentProvider, externalModels, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const model = e.target.value as ModelType;
      updateNodeData(node.id, { model });
      saveNanoBananaDefaults({ model });

      const newSelectedModel: SelectedModel = {
        provider: "gemini",
        modelId: model,
        displayName: GEMINI_IMAGE_MODELS.find(m => m.value === model)?.label || model,
      };
      updateNodeData(node.id, { selectedModel: newSelectedModel });
    },
    [node.id, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const aspectRatio = e.target.value as AspectRatio;
      updateNodeData(node.id, { aspectRatio });
      saveNanoBananaDefaults({ aspectRatio });
    },
    [node.id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const resolution = e.target.value as Resolution;
      updateNodeData(node.id, { resolution });
      saveNanoBananaDefaults({ resolution });
    },
    [node.id, updateNodeData]
  );

  const handleGoogleSearchToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const useGoogleSearch = e.target.checked;
      updateNodeData(node.id, { useGoogleSearch });
      saveNanoBananaDefaults({ useGoogleSearch });
    },
    [node.id, updateNodeData]
  );

  const handleImageSearchToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const useImageSearch = e.target.checked;
      updateNodeData(node.id, { useImageSearch });
      saveNanoBananaDefaults({ useImageSearch });
    },
    [node.id, updateNodeData]
  );

  const handleParametersChange = useCallback(
    (parameters: Record<string, unknown>) => {
      updateNodeData(node.id, { parameters });
    },
    [node.id, updateNodeData]
  );

  const handleBrowseModelSelect = useCallback((model: ProviderModel) => {
    const newSelectedModel: SelectedModel = {
      provider: model.provider,
      modelId: model.id,
      displayName: model.name,
      capabilities: model.capabilities,
    };
    updateNodeData(node.id, { selectedModel: newSelectedModel, parameters: {} });
    setIsBrowseDialogOpen(false);
  }, [node.id, updateNodeData]);

  const isGeminiProvider = currentProvider === "gemini";
  const currentModelId = isGeminiProvider ? (nodeData.selectedModel?.modelId || nodeData.model) : null;
  const supportsResolution = currentModelId === "nano-banana-pro" || currentModelId === "nano-banana-2";
  const aspectRatios = currentModelId === "nano-banana-2" ? EXTENDED_ASPECT_RATIOS : BASE_ASPECT_RATIOS;
  const resolutions = currentModelId === "nano-banana-2" ? RESOLUTIONS_NB2 : RESOLUTIONS_PRO;
  const hasExternalProviders = !!(replicateEnabled && replicateApiKey);

  return (
    <>
      <div className="space-y-3">
        {/* Model name + provider with link — sits directly under title divider */}
        <div className="border-t border-neutral-700 pt-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-neutral-100 truncate">
                {nodeData.selectedModel?.displayName || GEMINI_IMAGE_MODELS.find(m => m.value === nodeData.model)?.label || "Select model..."}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-neutral-500 truncate">
                  {enabledProviders.find(p => p.id === currentProvider)?.name || currentProvider}
                </span>
                {nodeData.selectedModel?.modelId && (
                  <a
                    href={getModelPageUrl(currentProvider, nodeData.selectedModel.modelId) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                    title={`View on ${getProviderDisplayName(currentProvider)}`}
                    onClick={(e) => {
                      if (!getModelPageUrl(currentProvider, nodeData.selectedModel?.modelId || "")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsBrowseDialogOpen(true)}
              className="nodrag nopan shrink-0 px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Gemini-specific controls */}
        {isGeminiProvider && (
          <>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Aspect Ratio</label>
              <select
                value={nodeData.aspectRatio || "1:1"}
                onChange={handleAspectRatioChange}
                className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {aspectRatios.map(ar => (
                  <option key={ar} value={ar}>{ar}</option>
                ))}
              </select>
            </div>

            {supportsResolution && (
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Resolution</label>
                <select
                  value={nodeData.resolution || "1K"}
                  onChange={handleResolutionChange}
                  className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {resolutions.map(res => (
                    <option key={res} value={res}>{res}</option>
                  ))}
                </select>
              </div>
            )}

            {(currentModelId === "nano-banana-pro" || currentModelId === "nano-banana-2") && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`google-search-${node.id}`}
                  checked={nodeData.useGoogleSearch || false}
                  onChange={handleGoogleSearchToggle}
                  className="nodrag nopan w-3 h-3 text-[var(--accent)] bg-neutral-700 border-neutral-600 rounded focus:ring-[var(--accent)]"
                />
                <label htmlFor={`google-search-${node.id}`} className="ml-2 text-xs text-neutral-300">
                  Google Search
                </label>
              </div>
            )}

            {currentModelId === "nano-banana-2" && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`image-search-${node.id}`}
                  checked={nodeData.useImageSearch || false}
                  onChange={handleImageSearchToggle}
                  className="nodrag nopan w-3 h-3 text-[var(--accent)] bg-neutral-700 border-neutral-600 rounded focus:ring-[var(--accent)]"
                />
                <label htmlFor={`image-search-${node.id}`} className="ml-2 text-xs text-neutral-300">
                  Image Search
                </label>
              </div>
            )}
          </>
        )}

        {/* External provider parameters */}
        {!isGeminiProvider && nodeData.selectedModel?.modelId && (
          <ModelParameters
            modelId={nodeData.selectedModel.modelId}
            provider={currentProvider}
            parameters={nodeData.parameters || {}}
            onParametersChange={handleParametersChange}
          />
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {isBrowseDialogOpen && (
        <ModelSearchDialog
          isOpen={isBrowseDialogOpen}
          onClose={() => setIsBrowseDialogOpen(false)}
          onModelSelected={handleBrowseModelSelect}
          initialCapabilityFilter="image"
        />
      )}
    </>
  );
}

// Generate Video Controls
function GenerateVideoControls({ node }: { node: Node }) {
  const nodeData = node.data as GenerateVideoNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);

  const currentProvider: ProviderType = nodeData.selectedModel?.provider || "fal";

  const handleParametersChange = useCallback(
    (parameters: Record<string, unknown>) => {
      updateNodeData(node.id, { parameters });
    },
    [node.id, updateNodeData]
  );

  const handleBrowseModelSelect = useCallback((model: ProviderModel) => {
    const newSelectedModel: SelectedModel = {
      provider: model.provider,
      modelId: model.id,
      displayName: model.name,
      capabilities: model.capabilities,
    };
    updateNodeData(node.id, { selectedModel: newSelectedModel, parameters: {} });
    setIsBrowseDialogOpen(false);
  }, [node.id, updateNodeData]);

  return (
    <>
      <div className="space-y-3">
        {/* Model name + provider with link */}
        <div className="border-t border-neutral-700 pt-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-neutral-100 truncate">
                {nodeData.selectedModel?.displayName || "Select model..."}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-neutral-500 truncate">
                  {getProviderDisplayName(currentProvider)}
                </span>
                {nodeData.selectedModel?.modelId && (
                  <a
                    href={getModelPageUrl(currentProvider, nodeData.selectedModel.modelId) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                    title={`View on ${getProviderDisplayName(currentProvider)}`}
                    onClick={(e) => {
                      if (!getModelPageUrl(currentProvider, nodeData.selectedModel?.modelId || "")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsBrowseDialogOpen(true)}
              className="nodrag nopan shrink-0 px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {nodeData.selectedModel?.modelId && (
          <ModelParameters
            modelId={nodeData.selectedModel.modelId}
            provider={currentProvider}
            parameters={nodeData.parameters || {}}
            onParametersChange={handleParametersChange}
          />
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {isBrowseDialogOpen && (
        <ModelSearchDialog
          isOpen={isBrowseDialogOpen}
          onClose={() => setIsBrowseDialogOpen(false)}
          onModelSelected={handleBrowseModelSelect}
          initialCapabilityFilter="video"
        />
      )}
    </>
  );
}

// Generate 3D Controls
function Generate3DControls({ node }: { node: Node }) {
  const nodeData = node.data as Generate3DNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);

  const currentProvider: ProviderType = nodeData.selectedModel?.provider || "fal";

  const handleParametersChange = useCallback(
    (parameters: Record<string, unknown>) => {
      updateNodeData(node.id, { parameters });
    },
    [node.id, updateNodeData]
  );

  const handleBrowseModelSelect = useCallback((model: ProviderModel) => {
    updateNodeData(node.id, {
      selectedModel: {
        provider: model.provider,
        modelId: model.id,
        displayName: model.name,
        capabilities: model.capabilities,
      },
      parameters: {}
    });
    setIsBrowseDialogOpen(false);
  }, [node.id, updateNodeData]);

  return (
    <>
      <div className="space-y-3">
        {/* Model name + provider with link */}
        <div className="border-t border-neutral-700 pt-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-neutral-100 truncate">
                {nodeData.selectedModel?.displayName || "Select model..."}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-neutral-500 truncate">
                  {getProviderDisplayName(currentProvider)}
                </span>
                {nodeData.selectedModel?.modelId && (
                  <a
                    href={getModelPageUrl(currentProvider, nodeData.selectedModel.modelId) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                    title={`View on ${getProviderDisplayName(currentProvider)}`}
                    onClick={(e) => {
                      if (!getModelPageUrl(currentProvider, nodeData.selectedModel?.modelId || "")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsBrowseDialogOpen(true)}
              className="nodrag nopan shrink-0 px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {nodeData.selectedModel?.modelId && (
          <ModelParameters
            modelId={nodeData.selectedModel.modelId}
            provider={currentProvider}
            parameters={nodeData.parameters || {}}
            onParametersChange={handleParametersChange}
          />
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {isBrowseDialogOpen && (
        <ModelSearchDialog
          isOpen={isBrowseDialogOpen}
          onClose={() => setIsBrowseDialogOpen(false)}
          onModelSelected={handleBrowseModelSelect}
          initialCapabilityFilter="3d"
        />
      )}
    </>
  );
}

// Generate Audio Controls
function GenerateAudioControls({ node }: { node: Node }) {
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-400">
        Audio generation settings
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

// LLM Controls
function LLMControls({ node }: { node: Node }) {
  const nodeData = node.data as LLMGenerateNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as LLMProvider;
      const firstModelForProvider = LLM_MODELS[newProvider][0].value;
      const updates: Partial<LLMGenerateNodeData> = {
        provider: newProvider,
        model: firstModelForProvider,
      };
      if (newProvider === "anthropic" && nodeData.temperature > 1) {
        updates.temperature = 1;
      }
      updateNodeData(node.id, updates);
    },
    [node.id, updateNodeData, nodeData.temperature]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(node.id, { model: e.target.value as LLMModelType });
    },
    [node.id, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(node.id, { temperature: parseFloat(e.target.value) });
    },
    [node.id, updateNodeData]
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(node.id, { maxTokens: parseInt(e.target.value, 10) });
    },
    [node.id, updateNodeData]
  );

  const provider = nodeData.provider || "google";
  const availableModels = LLM_MODELS[provider] || LLM_MODELS.google;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">Provider</label>
        <select
          value={provider}
          onChange={handleProviderChange}
          className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {LLM_PROVIDERS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">Model</label>
        <select
          value={nodeData.model || availableModels[0].value}
          onChange={handleModelChange}
          className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {availableModels.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">
          Temperature: {(nodeData.temperature ?? 0.7).toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max={provider === "anthropic" ? "1" : "2"}
          step="0.01"
          value={nodeData.temperature ?? 0.7}
          onChange={handleTemperatureChange}
          className="nodrag nopan w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">
          Max Tokens: {(nodeData.maxTokens || 2048).toLocaleString()}
        </label>
        <input
          type="range"
          min="256"
          max="16384"
          step="256"
          value={nodeData.maxTokens || 2048}
          onChange={handleMaxTokensChange}
          className="nodrag nopan w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

// Ease Curve Controls
function EaseCurveControls({ node }: { node: Node }) {
  const nodeData = node.data as EaseCurveNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const [showPresets, setShowPresets] = useState(false);
  const presetsButtonRef = useRef<HTMLButtonElement>(null);
  const presetsPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPresets) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPresets(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsButtonRef.current?.contains(e.target as HTMLElement)) return;
      if (presetsPopupRef.current?.contains(e.target as HTMLElement)) return;
      setShowPresets(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPresets]);

  const inheritedEdge = useMemo(() => {
    return edges.find((e) => e.target === node.id && e.targetHandle === "easeCurve") || null;
  }, [edges, node.id]);

  const isInherited = !!inheritedEdge;

  const handleBreakInheritance = useCallback(() => {
    if (inheritedEdge) {
      removeEdge(inheritedEdge.id);
      updateNodeData(node.id, { inheritedFrom: null });
    }
  }, [inheritedEdge, removeEdge, node.id, updateNodeData]);

  const handleBezierChange = useCallback(
    (value: [number, number, number, number]) => {
      updateNodeData(node.id, { bezierHandles: value, easingPreset: null });
    },
    [node.id, updateNodeData]
  );

  const handleSelectEasing = useCallback(
    (name: string) => {
      updateNodeData(node.id, {
        easingPreset: name,
        bezierHandles: getEasingBezier(name),
      });
      setShowPresets(false);
    },
    [node.id, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      updateNodeData(node.id, { outputDuration: isNaN(val) ? 1.5 : Math.max(0.1, Math.min(30, val)) });
    },
    [node.id, updateNodeData]
  );

  const editorEasingCurve = useMemo(() => {
    if (!nodeData.easingPreset) return undefined;
    return generateEasingPolyline(nodeData.easingPreset, 100, 100, 50);
  }, [nodeData.easingPreset]);

  const presetThumbnails = useMemo(() => {
    return ALL_EASING_NAMES.map((name) => ({
      name,
      polyline: generateEasingPolyline(name, 36, 36),
      isPreset: PRESET_NAMES.has(name),
    }));
  }, []);

  return (
    <div className="space-y-3 relative">
      {isInherited && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 rounded z-10">
          <p className="text-sm text-neutral-200 font-medium">Settings inherited</p>
          <p className="text-[11px] text-neutral-400 mt-1">Break connection to edit manually</p>
          <button
            className="nodrag nopan mt-3 px-3 py-1.5 bg-[var(--accent-subtle)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] rounded text-xs text-neutral-200 transition-colors"
            onClick={handleBreakInheritance}
          >
            Control manually
          </button>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-neutral-300">Easing Function</label>
          <button
            ref={presetsButtonRef}
            onClick={() => setShowPresets(!showPresets)}
            className="nodrag nopan text-xs px-2 py-0.5 bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
          >
            Presets
          </button>
        </div>
        <CubicBezierEditor
          value={nodeData.bezierHandles || [0.42, 0, 0.58, 1]}
          onChange={handleBezierChange}
          onCommit={handleBezierChange}
          easingCurve={editorEasingCurve}
        />
        {nodeData.easingPreset && (
          <div className="text-xs text-neutral-400 mt-1">
            Current: {nodeData.easingPreset}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">
          Output Duration: {nodeData.outputDuration?.toFixed(1) || "1.5"}s
        </label>
        <input
          type="number"
          min="0.1"
          max="30"
          step="0.1"
          value={nodeData.outputDuration || 1.5}
          onChange={handleDurationChange}
          className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Check className="w-3 h-3" />
          {isRunning ? "Applying..." : "Apply"}
        </button>
      </div>

      {showPresets && typeof document !== 'undefined' && createPortal(
        <div
          ref={presetsPopupRef}
          className="fixed z-[100] bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-2 max-h-[60vh] overflow-y-auto nowheel"
          style={{
            top: presetsButtonRef.current?.getBoundingClientRect().bottom || 0,
            right: window.innerWidth - (presetsButtonRef.current?.getBoundingClientRect().left || 0),
            width: 280,
          }}
        >
          <div className="grid grid-cols-4 gap-1">
            {presetThumbnails.map(({ name, polyline }) => (
              <button
                key={name}
                onClick={() => handleSelectEasing(name)}
                className="nodrag nopan p-1 bg-neutral-900 hover:bg-neutral-700 rounded flex flex-col items-center gap-1 transition-colors"
                title={name}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke="#a3a3a3"
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="text-[8px] text-neutral-400 text-center break-words w-full">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Conditional Switch Controls
function ConditionalSwitchControls({ node }: { node: Node }) {
  const nodeData = node.data as ConditionalSwitchNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleRuleValueChange = useCallback(
    (ruleId: string, newValue: string) => {
      const updatedRules = nodeData.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, value: newValue } : rule
      );
      updateNodeData(node.id, { rules: updatedRules, evaluationPaused: false });
    },
    [node.id, nodeData.rules, updateNodeData]
  );

  const handleModeChange = useCallback(
    (ruleId: string, newMode: MatchMode) => {
      const updatedRules = nodeData.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, mode: newMode } : rule
      );
      updateNodeData(node.id, { rules: updatedRules, evaluationPaused: false });
    },
    [node.id, nodeData.rules, updateNodeData]
  );

  const handleLabelEdit = useCallback(
    (ruleId: string, newLabel: string) => {
      const updatedRules = nodeData.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, label: newLabel } : rule
      );
      updateNodeData(node.id, { rules: updatedRules });
      setEditingId(null);
    },
    [node.id, nodeData.rules, updateNodeData]
  );

  const handleDelete = useCallback(
    (ruleId: string) => {
      if (nodeData.rules.length <= 1) return;
      const updatedRules = nodeData.rules.filter((rule) => rule.id !== ruleId);
      updateNodeData(node.id, { rules: updatedRules });
    },
    [node.id, nodeData.rules, updateNodeData]
  );

  const handleAddRule = useCallback(() => {
    const newRule: ConditionalSwitchRule = {
      id: "rule-" + Math.random().toString(36).slice(2, 9),
      value: "",
      mode: "contains",
      label: `Rule ${nodeData.rules.length + 1}`,
      isMatched: false,
    };
    updateNodeData(node.id, { rules: [...nodeData.rules, newRule] });
  }, [node.id, nodeData.rules, updateNodeData]);

  return (
    <div className="space-y-2">
      {nodeData.rules.map((rule, index) => (
        <div key={rule.id} className="border border-neutral-600 rounded p-2 space-y-2">
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={editingId === rule.id ? rule.label : rule.label || `Rule ${index + 1}`}
              onChange={(e) => handleLabelEdit(rule.id, e.target.value)}
              onFocus={() => setEditingId(rule.id)}
              onBlur={() => setEditingId(null)}
              className="nodrag nopan flex-1 px-1 py-0.5 text-xs bg-transparent border-none text-neutral-200 focus:outline-none"
            />
            {nodeData.rules.length > 1 && (
              <button
                onClick={() => handleDelete(rule.id)}
                className="nodrag nopan text-neutral-500 hover:text-red-400"
                title="Delete rule"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={rule.mode}
            onChange={(e) => handleModeChange(rule.id, e.target.value as MatchMode)}
            className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="exact">Exact match</option>
            <option value="contains">Contains</option>
            <option value="starts-with">Starts with</option>
            <option value="ends-with">Ends with</option>
          </select>

          <input
            type="text"
            value={rule.value}
            onChange={(e) => handleRuleValueChange(rule.id, e.target.value)}
            placeholder="Enter match value"
            className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />

          {rule.isMatched !== undefined && (
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${rule.isMatched ? 'bg-green-500' : 'bg-neutral-600'}`} />
              <span className="text-xs text-neutral-400">
                {rule.isMatched ? 'Matched' : 'Not matched'}
              </span>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={handleAddRule}
        className="nodrag nopan w-full px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
      >
        + Add Rule
      </button>

      <div className="flex justify-end">
        <button
          onClick={() => regenerateNode(node.id)}
          disabled={isRunning}
          className="nodrag nopan inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] rounded text-[var(--btn-primary-text)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Neural Atelier Controls
// ══════════════════════════════════════════════════════════

const NA_PACK_ID = "comfyui_neural_atelier";

function NASketchToPhotoControls({ node }: { node: Node }) {
  const nodeData = node.data as NASketchToPhotoData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [profiles, setProfiles] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/custom-nodes/${NA_PACK_ID}/configs/NA_Sketch_to_Photo_Orchestrator`)
      .then((r) => r.json())
      .then((d) => { if (d.files) setProfiles(d.files); })
      .catch(() => { console.warn("Failed to load NA Sketch to Photo profiles"); });
  }, []);

  const selectClass = "w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Prompt Profile</label>
        <select value={nodeData.promptProfile || ""} onChange={(e) => updateNodeData(node.id, { promptProfile: e.target.value })} className={selectClass}>
          {profiles.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Brief</label>
        <textarea value={nodeData.briefText || ""} onChange={(e) => updateNodeData(node.id, { briefText: e.target.value })}
          placeholder="Describe the garment, colors, materials..." rows={4}
          className="w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder:text-neutral-600" />
      </div>
      <NAGenerationControls nodeId={node.id} data={nodeData} />
      <div className="pt-2 border-t border-neutral-700">
        <button onClick={() => regenerateNode(node.id)} disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 disabled:opacity-50 transition-all">
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

function NAStylingDetailControls({ node }: { node: Node }) {
  const nodeData = node.data as NAStylingDetailData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [garmentTypes, setGarmentTypes] = useState<{ value: string; label: string; categories: { value: string; label: string; options: { value: string; label: string }[] }[] }[]>([]);

  useEffect(() => {
    fetch(`/api/custom-nodes/${NA_PACK_ID}/configs/NA_Styling_Detail_Change/garments.json`)
      .then((r) => r.json())
      .then((config) => { if (config.garment_types) setGarmentTypes(config.garment_types); })
      .catch(() => { console.warn("Failed to load NA Styling Detail garment types"); });
  }, []);

  const currentGarment = garmentTypes.find((g) => g.value === nodeData.garmentType);
  const categories = currentGarment?.categories || [];
  const currentCategory = categories.find((c: { value: string }) => c.value === nodeData.detailCategory);
  const options = currentCategory?.options || [];

  const selectClass = "w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Garment Type</label>
        <select value={nodeData.garmentType || ""} onChange={(e) => updateNodeData(node.id, { garmentType: e.target.value, detailCategory: "", detailOption: "" })} className={selectClass}>
          <option value="">Select...</option>
          {garmentTypes.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Detail Category</label>
        <select value={nodeData.detailCategory || ""} onChange={(e) => updateNodeData(node.id, { detailCategory: e.target.value, detailOption: "" })} className={selectClass} disabled={!nodeData.garmentType}>
          <option value="">Select...</option>
          {categories.map((c: { value: string; label: string }) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Detail Option</label>
        <select value={nodeData.detailOption || ""} onChange={(e) => updateNodeData(node.id, { detailOption: e.target.value })} className={selectClass} disabled={!nodeData.detailCategory}>
          <option value="">Select...</option>
          {options.map((o: { value: string; label: string }) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Description</label>
        <textarea value={nodeData.description || ""} onChange={(e) => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional override" rows={2}
          className="w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder:text-neutral-600" />
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Brief</label>
        <textarea value={nodeData.brief || ""} onChange={(e) => updateNodeData(node.id, { brief: e.target.value })}
          placeholder="Additional context..." rows={2}
          className="w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder:text-neutral-600" />
      </div>
      <NAGenerationControls nodeId={node.id} data={nodeData} />
      <div className="pt-2 border-t border-neutral-700">
        <button onClick={() => regenerateNode(node.id)} disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 disabled:opacity-50 transition-all">
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

function NARecolorControls({ node }: { node: Node }) {
  const nodeData = node.data as NARecolorData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const [curatedColors, setCuratedColors] = useState<string[]>(["-- Select --"]);
  const [allColors, setAllColors] = useState<string[]>(["-- Select --"]);

  useEffect(() => {
    const loadColors = async (filename: string, setter: (c: string[]) => void) => {
      try {
        const r = await fetch(`/api/custom-nodes/${NA_PACK_ID}/configs/NA_Recolor/${filename}`);
        const d = await r.json();
        const colors = ["-- Select a Pantone color --"];
        for (const family of d.color_families || [])
          for (const group of family.groups || [])
            for (const color of group.colors || [])
              if (color.pantone_code && color.common_name)
                colors.push(`${color.common_name} - Pantone ${color.pantone_code}`);
        setter(colors);
      } catch { /* ignore */ }
    };
    loadColors("colors.json", setCuratedColors);
    loadColors("pantone_all.json", setAllColors);
  }, []);

  const selectClass = "w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Pantone (Curated)</label>
        <select value={nodeData.pantoneColorCurated || ""} onChange={(e) => updateNodeData(node.id, { pantoneColorCurated: e.target.value })} className={selectClass}>
          {curatedColors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Pantone (All)</label>
        <select value={nodeData.pantoneColor || ""} onChange={(e) => updateNodeData(node.id, { pantoneColor: e.target.value })} className={selectClass}>
          {allColors.map((c, i) => <option key={`${c}-${i}`} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Brief</label>
        <textarea value={nodeData.brief || ""} onChange={(e) => updateNodeData(node.id, { brief: e.target.value })}
          placeholder="Additional context for recoloring..." rows={3}
          className="w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder:text-neutral-600" />
      </div>
      <NAGenerationControls nodeId={node.id} data={nodeData} />
      <div className="pt-2 border-t border-neutral-700">
        <button onClick={() => regenerateNode(node.id)} disabled={isRunning}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 disabled:opacity-50 transition-all">
          <Play className="w-3 h-3" />
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}

function NAGenerationControls({ nodeId, data }: { nodeId: string; data: { imageModel: string; aspectRatio: string; resolution: string; topP: number } }) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const selectClass = "w-full text-sm bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500";

  return (
    <>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Model</label>
        <select value={data.imageModel} onChange={(e) => updateNodeData(nodeId, { imageModel: e.target.value })} className={selectClass}>
          {NA_IMAGE_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Aspect Ratio</label>
          <select value={data.aspectRatio} onChange={(e) => updateNodeData(nodeId, { aspectRatio: e.target.value })} className={selectClass}>
            {NA_ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Resolution</label>
          <select value={data.resolution} onChange={(e) => updateNodeData(nodeId, { resolution: e.target.value })} className={selectClass}>
            {NA_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-neutral-400">top_p</label>
          <span className="text-xs text-neutral-500 font-mono">{data.topP.toFixed(2)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.05" value={data.topP}
          onChange={(e) => updateNodeData(nodeId, { topP: parseFloat(e.target.value) })}
          className="w-full h-1.5 accent-[var(--accent)]" />
      </div>
    </>
  );
}
