"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, Grid3x3 } from "lucide-react";
import { useCallback, useState, useEffect, useMemo } from "react";
import { SplitGridSettingsModal } from "../SplitGridSettingsModal";
import { BaseNode } from "./BaseNode";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useWorkflowStore } from "@/store/workflowStore";
import { SplitGridNodeData } from "@/types";

type SplitGridNodeType = Node<SplitGridNodeData, "splitGrid">;

export function SplitGridNode({ id, data, selected }: NodeProps<SplitGridNodeType>) {
  const nodeData = data;
  const adaptiveSourceImage = useAdaptiveImageSrc(nodeData.sourceImage, id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const [showSettings, setShowSettings] = useState(false);

  // Reactively track the connected source image
  const hasIncomingImageConnection = useMemo(() => {
    return edges.some((edge) => edge.target === id && edge.targetHandle === "image");
  }, [edges, id]);

  const connectedSourceImage = useMemo(() => {
    if (!hasIncomingImageConnection) return null;
    const { images } = getConnectedInputs(id);
    return images[0] || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIncomingImageConnection, id, getConnectedInputs, nodes]);

  useEffect(() => {
    if (connectedSourceImage !== nodeData.sourceImage) {
      updateNodeData(id, { sourceImage: connectedSourceImage });
    }
  }, [connectedSourceImage, id, updateNodeData, nodeData.sourceImage]);

  // Show settings modal on first creation (when not configured)
  useEffect(() => {
    if (!nodeData.isConfigured && (!nodeData.childNodeIds || nodeData.childNodeIds.length === 0)) {
      setShowSettings(true);
    }
  }, [nodeData.isConfigured, nodeData.childNodeIds]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleSplit = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  return (
    <>
      <BaseNode
        id={id}
        selected={selected}
        hasError={nodeData.status === "error"}
        fullBleed
        aspectFitMedia={nodeData.sourceImage}
      >
        {/* Image input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="image"
          data-handletype="image"
          style={{ top: "50%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
          style={{ right: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "var(--handle-color-image)", zIndex: 10 }}>
          Image
        </div>

        {/* Reference output handles for child nodes (distribute evenly) */}
        <Handle
          type="source"
          position={Position.Right}
          id="reference-0"
          data-handletype="reference"
          style={{ top: "25%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{ left: "calc(100% + 8px)", top: "calc(25% - 7px)", color: "var(--handle-color-reference)", zIndex: 10 }}>
          Ref
        </div>

        <Handle
          type="source"
          position={Position.Right}
          id="reference-1"
          data-handletype="reference"
          style={{ top: "50%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{ left: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "var(--handle-color-reference)", zIndex: 10 }}>
          Ref
        </div>

        <Handle
          type="source"
          position={Position.Right}
          id="reference-2"
          data-handletype="reference"
          style={{ top: "75%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{ left: "calc(100% + 8px)", top: "calc(75% - 7px)", color: "var(--handle-color-reference)", zIndex: 10 }}>
          Ref
        </div>

        {/* Full-bleed preview area */}
        {nodeData.sourceImage ? (
          <div className="relative w-full h-full">
            <img
              src={adaptiveSourceImage ?? undefined}
              alt="Source grid"
              className="w-full h-full object-contain rounded-lg"
            />
            {/* Grid overlay visualization */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${nodeData.gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${nodeData.gridRows}, 1fr)`,
              }}
            >
              {Array.from({ length: nodeData.targetCount }).map((_, i) => (
                <div
                  key={i}
                  className="border border-[var(--accent)]/50"
                />
              ))}
            </div>
            {/* Loading overlay */}
            {nodeData.status === "loading" && (
              <div className="absolute inset-0 bg-neutral-900/70 rounded-lg flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-50" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full min-h-[112px] bg-neutral-900/40 flex flex-col items-center justify-center rounded-lg">
            {nodeData.status === "error" ? (
              <span className="text-[10px] text-red-400 text-center px-2">
                {nodeData.error || "Error"}
              </span>
            ) : nodeData.status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : (
              <>
                <Grid3x3 className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
                <span className="text-neutral-500 text-[10px] mt-1">
                  Connect image
                </span>
              </>
            )}
          </div>
        )}

        {/* Controls overlay pinned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2 bg-neutral-900/90 rounded-b-lg space-y-1">
          {/* Config summary */}
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <span>{nodeData.gridRows}x{nodeData.gridCols} grid ({nodeData.targetCount} images)</span>
            <button
              onClick={handleOpenSettings}
              className="nodrag nopan text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              Settings
            </button>
          </div>

          {/* Child node count / status */}
          <div className="flex items-center justify-between">
            {nodeData.isConfigured ? (
              <div className="text-[10px] text-neutral-500">
                {nodeData.childNodeIds?.length ?? 0} generate sets created
              </div>
            ) : (
              <div className="text-[10px] text-amber-400">
                Not configured - click Settings
              </div>
            )}

            {/* Split button */}
            <button
              onClick={handleSplit}
              disabled={isRunning || !nodeData.isConfigured || !nodeData.sourceImage}
              className="nodrag nopan px-2 py-0.5 text-[10px] border border-[var(--surface-1)] hover:bg-[var(--surface-1)] hover:text-neutral-900 disabled:border-neutral-600 disabled:text-neutral-600 disabled:cursor-not-allowed text-[var(--surface-1)] rounded transition-colors"
              title={!nodeData.isConfigured ? "Configure node first" : !nodeData.sourceImage ? "Connect an image first" : "Split grid"}
            >
              Split
            </button>
          </div>
        </div>
      </BaseNode>

      {/* Settings Modal */}
      <SplitGridSettingsModal
        nodeId={id}
        nodeData={nodeData}
        isOpen={showSettings}
        onOpenChange={(open) => { if (!open) handleCloseSettings(); }}
      />
    </>
  );
}
