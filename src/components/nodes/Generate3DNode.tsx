"use client";

import { Handle, Position, NodeProps, Node, useReactFlow } from "@xyflow/react";
import { Box, Loader2, AlertTriangle, Folder, X } from "lucide-react";
import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { BaseNode } from "./BaseNode";
import { InlineParameterPanel } from "./InlineParameterPanel";
import { ModelParameters } from "./ModelParameters";
import { ProviderBadge } from "./ProviderBadge";
import { ModelSearchDialog } from "@/components/modals/ModelSearchDialog";
import { useToast } from "@/components/Toast";
import { useInlineParameters } from "@/hooks/useInlineParameters";
import { ProviderModel, ModelCapability } from "@/lib/providers/types";
import { useWorkflowStore, useProviderApiKeys } from "@/store/workflowStore";
import { Generate3DNodeData, ProviderType, SelectedModel, ModelInputDef } from "@/types";
import { browseRegistry } from "@/utils/browseRegistry";
import { getModelPageUrl, getProviderDisplayName } from "@/utils/providerUrls";

// 3D generation capabilities
const THREE_D_CAPABILITIES: ModelCapability[] = ["text-to-3d", "image-to-3d"];

type Generate3DNodeType = Node<Generate3DNodeData, "generate3d">;

export function Generate3DNode({ id, data, selected }: NodeProps<Generate3DNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const { replicateApiKey, falApiKey, kieApiKey } = useProviderApiKeys();
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);

  // Inline parameters infrastructure
  const { inlineParametersEnabled } = useInlineParameters();

  // Register browse callback for floating header button
  useEffect(() => {
    browseRegistry.register(id, () => setIsBrowseDialogOpen(true));
    return () => { browseRegistry.unregister(id); };
  }, [id]);

  // Get the current selected provider (default to fal since most 3D models are there)
  const currentProvider: ProviderType = nodeData.selectedModel?.provider || "fal";

  const handleParametersChange = useCallback(
    (parameters: Record<string, unknown>) => {
      updateNodeData(id, { parameters });
    },
    [id, updateNodeData]
  );

  // Handle inputs loaded from schema
  const handleInputsLoaded = useCallback(
    (inputs: ModelInputDef[]) => {
      updateNodeData(id, { inputSchema: inputs });
    },
    [id, updateNodeData]
  );

  // Handle parameters expand/collapse - resize node height
  const { setNodes } = useReactFlow();
  const handleParametersExpandChange = useCallback(
    (expanded: boolean, parameterCount: number) => {
      const parameterHeight = expanded ? Math.max(parameterCount * 28 + 16, 60) : 0;
      const baseHeight = 300;
      const newHeight = baseHeight + parameterHeight;

      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, style: { ...node.style, height: newHeight } }
            : node
        )
      );
    },
    [id, setNodes]
  );

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  // Handle model selection from browse dialog
  const handleBrowseModelSelect = useCallback((model: ProviderModel) => {
    const newSelectedModel: SelectedModel = {
      provider: model.provider,
      modelId: model.id,
      displayName: model.name,
    };
    updateNodeData(id, { selectedModel: newSelectedModel, parameters: {} });
    setIsBrowseDialogOpen(false);
  }, [id, updateNodeData]);

  // Dynamic title based on selected model
  const displayTitle = useMemo(() => {
    if (nodeData.selectedModel?.displayName && nodeData.selectedModel.modelId) {
      return nodeData.selectedModel.displayName;
    }
    return "Select 3D model...";
  }, [nodeData.selectedModel?.displayName, nodeData.selectedModel?.modelId]);

  // Inline parameters: compute collapse state and toggle handler
  const isParamsExpanded = nodeData.parametersExpanded ?? true; // default expanded

  const handleToggleParams = useCallback(() => {
    updateNodeData(id, { parametersExpanded: !isParamsExpanded });
  }, [id, isParamsExpanded, updateNodeData]);

  // Track previous status to detect error transitions
  const prevStatusRef = useRef(nodeData.status);

  // Show toast when error occurs
  useEffect(() => {
    if (nodeData.status === "error" && prevStatusRef.current !== "error" && nodeData.error) {
      useToast.getState().show("3D generation failed", "error", true, nodeData.error);
    }
    prevStatusRef.current = nodeData.status;
  }, [nodeData.status, nodeData.error]);

  const handleClear3D = useCallback(() => {
    updateNodeData(id, { output3dUrl: null, savedFilename: null, savedFilePath: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  return (
    <>
    <BaseNode
      id={id}
      selected={selected}
      settingsExpanded={inlineParametersEnabled && isParamsExpanded}
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      settingsPanel={inlineParametersEnabled ? (
        <InlineParameterPanel
          expanded={isParamsExpanded}
          onToggle={handleToggleParams}
          nodeId={id}
        >
          {/* Model selector: Browse button + current model display */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-neutral-200 truncate">
                {displayTitle}
              </div>
              <div className="text-[9px] text-neutral-500">
                {currentProvider}
              </div>
            </div>
            <button
              onClick={() => setIsBrowseDialogOpen(true)}
              className="nodrag nopan shrink-0 px-2 py-1 text-[10px] bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
            >
              Browse
            </button>
          </div>

          {/* External provider parameters - reuse ModelParameters component */}
          {nodeData.selectedModel?.modelId && (
            <ModelParameters
              modelId={nodeData.selectedModel.modelId}
              provider={currentProvider}
              parameters={nodeData.parameters || {}}
              onParametersChange={handleParametersChange}
              onInputsLoaded={handleInputsLoaded}
            />
          )}
        </InlineParameterPanel>
      ) : undefined}
    >
      {/* Dynamic input handles based on model schema */}
      {nodeData.inputSchema && nodeData.inputSchema.length > 0 ? (
        (() => {
          const imageInputs = nodeData.inputSchema!.filter(i => i.type === "image");
          const textInputs = nodeData.inputSchema!.filter(i => i.type === "text");

          const hasImageInput = imageInputs.length > 0;
          const hasTextInput = textInputs.length > 0;

          const handles: Array<{
            id: string;
            type: "image" | "text";
            label: string;
            schemaName: string | null;
            description: string | null;
            isPlaceholder: boolean;
          }> = [];

          if (hasImageInput) {
            imageInputs.forEach((input, index) => {
              handles.push({
                id: `image-${index}`,
                type: "image",
                label: input.label,
                schemaName: input.name,
                description: input.description || null,
                isPlaceholder: false,
              });
            });
          } else {
            handles.push({
              id: "image",
              type: "image",
              label: "Image",
              schemaName: null,
              description: "Not used by this model",
              isPlaceholder: true,
            });
          }

          if (hasTextInput) {
            textInputs.forEach((input, index) => {
              handles.push({
                id: `text-${index}`,
                type: "text",
                label: input.label,
                schemaName: input.name,
                description: input.description || null,
                isPlaceholder: false,
              });
            });
          } else {
            handles.push({
              id: "text",
              type: "text",
              label: "Prompt",
              schemaName: null,
              description: "Not used by this model",
              isPlaceholder: true,
            });
          }

          const imageHandles = handles.filter(h => h.type === "image");
          const textHandles = handles.filter(h => h.type === "text");
          const totalSlots = imageHandles.length + textHandles.length + 1;

          const renderedHandles = handles.map((handle) => {
            const isImage = handle.type === "image";
            const typeIndex = isImage
              ? imageHandles.findIndex(h => h.id === handle.id)
              : textHandles.findIndex(h => h.id === handle.id);
            const adjustedIndex = isImage ? typeIndex : imageHandles.length + 1 + typeIndex;
            const topPercent = ((adjustedIndex + 1) / (totalSlots + 1)) * 100;

            return (
              <React.Fragment key={handle.id}>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={handle.id}
                  style={{
                    top: `${topPercent}%`,
                    opacity: handle.isPlaceholder ? 0.3 : 1,
                  }}
                  data-handletype={handle.type}
                  data-schema-name={handle.schemaName || undefined}
                  isConnectable={true}
                  title={handle.description || handle.label}
                />
                <div
                  className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
                  style={{
                    right: `calc(100% + 8px)`,
                    top: `calc(${topPercent}% - 18px)`,
                    color: isImage ? "var(--handle-color-image)" : "var(--handle-color-text)",
                    opacity: handle.isPlaceholder ? 0.3 : 1,
                  }}
                >
                  {handle.label}
                </div>
              </React.Fragment>
            );
          });

          return (
            <>
              {renderedHandles}
              {hasImageInput && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id="image"
                  style={{ top: "35%", opacity: 0, pointerEvents: "none" }}
                  isConnectable={false}
                />
              )}
              {hasTextInput && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id="text"
                  style={{ top: "65%", opacity: 0, pointerEvents: "none" }}
                  isConnectable={false}
                />
              )}
            </>
          );
        })()
      ) : (
        // Default handles when no schema
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="image"
            style={{ top: "35%" }}
            data-handletype="image"
            isConnectable={true}
          />
          <div
            className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
            style={{
              right: `calc(100% + 8px)`,
              top: "calc(35% - 18px)",
              color: "var(--handle-color-image)",
            }}
          >
            Image
          </div>
          <Handle
            type="target"
            position={Position.Left}
            id="text"
            style={{ top: "65%" }}
            data-handletype="text"
          />
          <div
            className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
            style={{
              right: `calc(100% + 8px)`,
              top: "calc(65% - 18px)",
              color: "var(--handle-color-text)",
            }}
          >
            Prompt
          </div>
        </>
      )}

      {/* 3D output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="3d"
        data-handletype="3d"
      />
      {/* Output label */}
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{
          left: `calc(100% + 8px)`,
          top: "calc(50% - 18px)",
          color: "var(--handle-color-3d)",
        }}
      >
        3D
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Preview area */}
        {nodeData.output3dUrl ? (
          <div className="relative w-full flex-1 min-h-[80px] flex flex-col items-center justify-center gap-2 bg-neutral-800 rounded border border-neutral-700 p-3">
            <Box className="w-8 h-8 text-orange-400" />
            <span className="text-[11px] text-orange-400 font-medium">3D Model Generated</span>
            {nodeData.savedFilename ? (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!nodeData.savedFilePath) {
                    useToast.getState().show("No file path available", "error");
                    return;
                  }
                  try {
                    const res = await fetch("/api/open-file", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ filePath: nodeData.savedFilePath }),
                    });
                    if (!res.ok) {
                      const detail = await res.text().catch(() => `Status ${res.status}`);
                      useToast.getState().show("Failed to open file", "error", true, detail);
                    }
                  } catch (err) {
                    console.error("Failed to open file location:", err);
                    useToast.getState().show("Failed to open file location", "error");
                  }
                }}
                className="nodrag nopan text-[10px] text-neutral-400 hover:text-orange-300 truncate max-w-full cursor-pointer transition-colors flex items-center gap-1"
                title={`Open in explorer: ${nodeData.savedFilePath}`}
              >
                <Folder className="w-3 h-3 shrink-0" />
                {nodeData.savedFilename}
              </button>
            ) : (
              <span className="text-[10px] text-neutral-500 truncate max-w-full">Connect to 3D Viewer</span>
            )}
            {/* Loading overlay for re-generation */}
            {nodeData.status === "loading" && (
              <div className="absolute inset-0 bg-neutral-900/70 rounded flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            {/* Error overlay */}
            {nodeData.status === "error" && (
              <div className="absolute inset-0 bg-red-900/40 rounded flex flex-col items-center justify-center gap-1">
                <AlertTriangle className="w-6 h-6 text-white" />
                <span className="text-white text-xs font-medium">Generation failed</span>
                <span className="text-white/70 text-[10px]">See toast for details</span>
              </div>
            )}
            <div className="absolute top-1 right-1">
              <button
                onClick={handleClear3D}
                className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors"
                title="Clear 3D model"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-[112px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center">
            {nodeData.status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : nodeData.status === "error" ? (
              <span className="text-[10px] text-red-400 text-center px-2">
                {nodeData.error || "Failed"}
              </span>
            ) : (
              <span className="text-neutral-500 text-[10px]">
                Run to generate
              </span>
            )}
          </div>
        )}

        {/* Model-specific parameters (hidden when inline enabled - shown in panel below) */}
        {!inlineParametersEnabled && nodeData.selectedModel?.modelId && (
          <ModelParameters
            modelId={nodeData.selectedModel.modelId}
            provider={currentProvider}
            parameters={nodeData.parameters || {}}
            onParametersChange={handleParametersChange}
            onExpandChange={handleParametersExpandChange}
            onInputsLoaded={handleInputsLoaded}
          />
        )}

      </div>
    </BaseNode>

    {/* Model browser dialog */}
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
