"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, X } from "lucide-react";
import React, { useMemo } from "react";
import { BaseNode } from "./BaseNode";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoFrameGrabNodeData } from "@/types";

type VideoFrameGrabNodeType = Node<VideoFrameGrabNodeData, "videoFrameGrab">;

export function VideoFrameGrabNode({ id, data, selected }: NodeProps<VideoFrameGrabNodeType>) {
  const nodeData = data;
  const adaptiveOutputImage = useAdaptiveImageSrc(nodeData.outputImage, id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);

  // Find connected source video from incoming edges
  const sourceVideoUrl = useMemo(() => {
    const incomingEdge = edges.find((e) => e.target === id && e.targetHandle === "video");
    if (!incomingEdge) return null;

    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    if (!sourceNode) return null;

    const d = sourceNode.data as Record<string, unknown>;
    return (d.outputVideo as string | null) ?? null;
  }, [edges, nodes, id]);

  const hasSourceVideo = Boolean(sourceVideoUrl);
  const canExtract = hasSourceVideo && nodeData.status !== "loading" && !isRunning;

  const handleExtract = () => {
    regenerateNode(id);
  };

  return (
    <BaseNode
      id={id}
      selected={selected}
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={320}
      aspectFitMedia={nodeData.outputImage}
    >
      {/* Video In (target, left, 50%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "rgb(168, 85, 247)" }}
      >
        Video In
      </div>

      {/* Image Out (source, right, 50%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "rgb(59, 130, 246)" }}
      >
        Image Out
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Image preview area */}
        <div className="flex-1 min-h-0 relative">
          {nodeData.outputImage ? (
            <>
              <img
                src={adaptiveOutputImage ?? undefined}
                className="absolute inset-0 w-full h-full object-contain rounded"
                alt="Extracted frame"
              />
              {/* Clear output button */}
              <button
                onClick={() => updateNodeData(id, { outputImage: null, status: "idle" })}
                className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors"
                title="Clear extracted frame"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border border-dashed border-neutral-600 rounded">
              <span className="text-[10px] text-neutral-500 text-center px-4">
                Connect a video and extract a frame
              </span>
            </div>
          )}
        </div>

        {/* Frame position toggle (only when source video connected) */}
        {hasSourceVideo && (
          <div className="nodrag nowheel shrink-0 flex gap-1 px-1">
            <button
              onClick={() => updateNodeData(id, { framePosition: "first", outputImage: null })}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                nodeData.framePosition === "first"
                  ? "bg-[var(--accent)] text-[var(--btn-primary-text)]"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              First
            </button>
            <button
              onClick={() => updateNodeData(id, { framePosition: "last", outputImage: null })}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                nodeData.framePosition === "last"
                  ? "bg-[var(--accent)] text-[var(--btn-primary-text)]"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Last
            </button>
          </div>
        )}

        {/* Extract Frame button */}
        <div className="shrink-0 flex justify-end px-1">
          <button
            onClick={handleExtract}
            disabled={!canExtract}
            className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed rounded text-[var(--btn-primary-text)] text-xs font-medium transition-colors"
          >
            {nodeData.status === "loading" ? "Extracting..." : "Extract Frame"}
          </button>
        </div>

        {/* Processing overlay */}
        {nodeData.status === "loading" && (
          <div className="absolute inset-0 bg-neutral-900/70 rounded flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-50" />
            <span className="text-neutral-50 text-xs">Extracting frame...</span>
          </div>
        )}

        {/* Error display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="shrink-0 px-2 py-1.5 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[10px] text-red-400 break-words">{nodeData.error}</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
