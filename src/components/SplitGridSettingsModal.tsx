"use client";

import { useState, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { SplitGridNodeData, AspectRatio, Resolution, ModelType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";

interface SplitGridSettingsModalProps {
  nodeId: string;
  nodeData: SplitGridNodeData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const LAYOUT_OPTIONS = [
  { rows: 2, cols: 2 },
  { rows: 1, cols: 5 },
  { rows: 2, cols: 3 },
  { rows: 3, cols: 2 },
  { rows: 2, cols: 4 },
  { rows: 3, cols: 3 },
  { rows: 2, cols: 5 },
] as const;

const BASE_ASPECT_RATIOS: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const EXTENDED_ASPECT_RATIOS: AspectRatio[] = ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];
const RESOLUTIONS_PRO: Resolution[] = ["1K", "2K", "4K"];
const RESOLUTIONS_NB2: Resolution[] = ["512", "1K", "2K", "4K"];
const MODELS: { value: ModelType; label: string }[] = [
  { value: "nano-banana", label: "Nano Banana" },
  { value: "nano-banana-2", label: "Nano Banana 2" },
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
];

const findLayoutIndex = (rows: number, cols: number): number => {
  const idx = LAYOUT_OPTIONS.findIndex(l => l.rows === rows && l.cols === cols);
  return idx >= 0 ? idx : 2; // default to 2x3
};

export function SplitGridSettingsModal({
  nodeId,
  nodeData,
  isOpen,
  onOpenChange,
}: SplitGridSettingsModalProps) {
  const { updateNodeData, addNode, onConnect, addEdgeWithType, getNodeById } = useWorkflowStore();

  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(
    findLayoutIndex(nodeData.gridRows, nodeData.gridCols)
  );
  const [defaultPrompt, setDefaultPrompt] = useState(nodeData.defaultPrompt);
  const [aspectRatio, setAspectRatio] = useState(nodeData.generateSettings.aspectRatio);
  const [resolution, setResolution] = useState(nodeData.generateSettings.resolution);
  const [model, setModel] = useState(nodeData.generateSettings.model);
  const [useGoogleSearch, setUseGoogleSearch] = useState(nodeData.generateSettings.useGoogleSearch);
  const [useImageSearch, setUseImageSearch] = useState(nodeData.generateSettings.useImageSearch);

  const { rows, cols } = LAYOUT_OPTIONS[selectedLayoutIndex];
  const targetCount = rows * cols;
  const isNanoBananaPro = model === "nano-banana-pro" || model === "nano-banana-2";
  const aspectRatios = model === "nano-banana-2" ? EXTENDED_ASPECT_RATIOS : BASE_ASPECT_RATIOS;
  const resolutions = model === "nano-banana-2" ? RESOLUTIONS_NB2 : RESOLUTIONS_PRO;

  const handleCreate = useCallback(() => {
    const splitNode = getNodeById(nodeId);
    if (!splitNode) return;

    // Node dimensions
    const imageInputWidth = 300;
    const imageInputHeight = 280;
    const promptWidth = 320;
    const promptHeight = 220;
    const nanoBananaWidth = 300;
    const nanoBananaHeight = 300;
    const horizontalGap = 40;
    const verticalGap = 30;

    // Calculate cluster dimensions
    // Layout: imageInput on left, nanoBanana on right, prompt below imageInput
    const clusterWidth = imageInputWidth + horizontalGap + nanoBananaWidth;
    const clusterHeight = Math.max(imageInputHeight, nanoBananaHeight) + verticalGap + promptHeight;
    const clusterGap = 60;

    // Start position to the right of the split node
    const startX = splitNode.position.x + 350;
    const startY = splitNode.position.y;

    const childNodeIds: SplitGridNodeData["childNodeIds"] = [];

    // Create node clusters for each grid cell
    for (let i = 0; i < targetCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Position for this cluster
      const clusterX = startX + col * (clusterWidth + clusterGap);
      const clusterY = startY + row * (clusterHeight + clusterGap);

      // Create imageInput node
      const imageInputId = addNode("imageInput", {
        x: clusterX,
        y: clusterY,
      });

      // Create nanoBanana node (to the right of imageInput)
      const nanoBananaId = addNode("nanoBanana", {
        x: clusterX + imageInputWidth + horizontalGap,
        y: clusterY,
      });

      // Update nanoBanana settings
      updateNodeData(nanoBananaId, {
        aspectRatio,
        resolution,
        model,
        useGoogleSearch,
        useImageSearch,
      });

      // Create prompt node (below imageInput)
      const promptId = addNode("prompt", {
        x: clusterX,
        y: clusterY + Math.max(imageInputHeight, nanoBananaHeight) + verticalGap,
      });

      // Update prompt with default text
      updateNodeData(promptId, { prompt: defaultPrompt });

      // Create connections: imageInput -> nanoBanana, prompt -> nanoBanana
      onConnect({
        source: imageInputId,
        sourceHandle: "image",
        target: nanoBananaId,
        targetHandle: "image",
      });

      onConnect({
        source: promptId,
        sourceHandle: "text",
        target: nanoBananaId,
        targetHandle: "text",
      });

      // Create reference edge from split node to imageInput (grey dotted line)
      addEdgeWithType({
        source: nodeId,
        sourceHandle: "reference",
        target: imageInputId,
        targetHandle: "reference",
      }, "reference");

      childNodeIds.push({
        imageInput: imageInputId,
        prompt: promptId,
        nanoBanana: nanoBananaId,
      });
    }

    // Update split node with configuration
    updateNodeData(nodeId, {
      targetCount,
      defaultPrompt,
      generateSettings: {
        aspectRatio,
        resolution,
        model,
        useGoogleSearch,
        useImageSearch,
      },
      childNodeIds,
      gridRows: rows,
      gridCols: cols,
      isConfigured: true,
    });

    onOpenChange(false);
  }, [
    nodeId, targetCount, defaultPrompt, aspectRatio, resolution,
    model, useGoogleSearch, useImageSearch, rows, cols, selectedLayoutIndex, getNodeById,
    addNode, updateNodeData, onConnect, addEdgeWithType, onOpenChange
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Split Grid Settings</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
          {/* Layout selector with visual preview */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Grid Layout
            </label>
            <div className="flex gap-2">
              {LAYOUT_OPTIONS.map((layout, index) => {
                const count = layout.rows * layout.cols;
                const isSelected = selectedLayoutIndex === index;
                return (
                  <button
                    key={`${layout.rows}x${layout.cols}`}
                    onClick={() => setSelectedLayoutIndex(index)}
                    className={`flex-1 p-2 rounded border transition-colors ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                        : "border-[var(--border)] hover:border-[var(--input-focus)]"
                    }`}
                  >
                    <div
                      className="aspect-video mx-auto w-12 grid gap-0.5"
                      style={{
                        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: count }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-sm ${
                            isSelected ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1 text-center">{layout.rows}x{layout.cols}</div>
                    <div className="text-[10px] text-[var(--text-muted)] text-center">{count}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Grid will be split into {rows}x{cols} = {targetCount} images
            </p>
          </div>

          {/* Default prompt */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Default Prompt
            </label>
            <textarea
              value={defaultPrompt}
              onChange={(e) => setDefaultPrompt(e.target.value)}
              placeholder="Enter prompt that will be applied to all generated images..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] resize-none"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Each prompt node can be edited individually after creation
            </p>
          </div>

          {/* Generate settings */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Generate Node Settings
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => {
                    const newModel = e.target.value as ModelType;
                    setModel(newModel);
                    // Normalize aspect ratio for the new model's allowed set
                    const newAspectRatios = newModel === "nano-banana-2" ? EXTENDED_ASPECT_RATIOS : BASE_ASPECT_RATIOS;
                    if (!newAspectRatios.includes(aspectRatio)) {
                      setAspectRatio(newAspectRatios[0]);
                    }
                    // Normalize resolution for the new model's allowed set
                    const newResolutions = newModel === "nano-banana-2" ? RESOLUTIONS_NB2 : RESOLUTIONS_PRO;
                    if (!newResolutions.includes(resolution)) {
                      setResolution(newResolutions[0]);
                    }
                  }}
                  className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)]"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)]"
                >
                  {aspectRatios.map((ar) => (
                    <option key={ar} value={ar}>{ar}</option>
                  ))}
                </select>
              </div>

              {isNanoBananaPro && (
                <>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Resolution
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as Resolution)}
                      className="w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)]"
                    >
                      {resolutions.map((res) => (
                        <option key={res} value={res}>{res}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useGoogleSearch}
                        onChange={(e) => setUseGoogleSearch(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-1)]"
                      />
                      Google Search
                    </label>
                  </div>
                  {model === "nano-banana-2" && (
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useImageSearch}
                          onChange={(e) => setUseImageSearch(e.target.checked)}
                          className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-1)]"
                        />
                        Image Search
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </DialogButton>
          <DialogButton variant="primary" onClick={handleCreate}>
            Create {targetCount} Generate Sets
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
