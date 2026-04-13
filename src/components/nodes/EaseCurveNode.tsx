"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo } from "react";
import { BaseNode } from "./BaseNode";
import { checkEncoderSupport } from "@/hooks/useStitchVideos";
import { useVideoAutoplay } from "@/hooks/useVideoAutoplay";
import { useVideoBlobUrl } from "@/hooks/useVideoBlobUrl";
import { useWorkflowStore } from "@/store/workflowStore";
import { EaseCurveNodeData } from "@/types";

type EaseCurveNodeType = Node<EaseCurveNodeData, "easeCurve">;

const VIDEO_HEIGHT = 320;

export function EaseCurveNode({ id, data, selected }: NodeProps<EaseCurveNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const videoBlobUrl = useVideoBlobUrl(nodeData.outputVideo ?? null);
  const videoAutoplayRef = useVideoAutoplay(id, selected);

  // Check encoder support on mount
  useEffect(() => {
    if (nodeData.encoderSupported === null) {
      checkEncoderSupport().then((supported) => {
        updateNodeData(id, { encoderSupported: supported });
      });
    }
  }, [id, nodeData.encoderSupported, updateNodeData]);

  // Check if this node has an incoming easeCurve connection (inheritance)
  const inheritedEdge = useMemo(() => {
    return edges.find((e) => e.target === id && e.targetHandle === "easeCurve") || null;
  }, [edges, id]);

  const handleBreakInheritance = useCallback(() => {
    if (inheritedEdge) {
      removeEdge(inheritedEdge.id);
      updateNodeData(id, { inheritedFrom: null });
    }
  }, [inheritedEdge, removeEdge, id, updateNodeData]);

  // Shared handles rendered in ALL states (4 handles with labels)
  const renderHandles = () => (
    <>
      {/* Video In (target, left, 35%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "35%" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(35% - 7px)", color: "rgb(168, 85, 247)" }}
      >
        Video In
      </div>

      {/* Video Out (source, right, 35%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "35%" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(35% - 7px)", color: "rgb(168, 85, 247)" }}
      >
        Video Out
      </div>

      {/* Settings In (target, left, 75%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="easeCurve"
        data-handletype="easeCurve"
        isConnectable={true}
        style={{ top: "75%", background: "rgb(190, 242, 100)" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(75% - 7px)", color: "rgb(190, 242, 100)" }}
      >
        Settings
      </div>

      {/* Settings Out (source, right, 75%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="easeCurve"
        data-handletype="easeCurve"
        isConnectable={true}
        style={{ top: "75%", background: "rgb(190, 242, 100)" }}
      />
      <div
        className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(75% - 7px)", color: "rgb(190, 242, 100)" }}
      >
        Settings
      </div>
    </>
  );

  // Encoder not supported
  if (nodeData.encoderSupported === false) {
    return (
      <BaseNode
        id={id}
        selected={selected}
        fullBleed
        minWidth={340}
        minHeight={VIDEO_HEIGHT}
      >
        {renderHandles()}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
          <AlertTriangle className="w-8 h-8 text-neutral-500" strokeWidth={1.5} />
          <span className="text-xs text-neutral-400">
            Your browser doesn&apos;t support video encoding.
          </span>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] underline"
          >
            Need help? Contact the AGENT 1 admin team.
          </a>
        </div>
      </BaseNode>
    );
  }

  // Checking encoder state
  if (nodeData.encoderSupported === null) {
    return (
      <BaseNode
        id={id}
        selected={selected}
        fullBleed
        minWidth={340}
        minHeight={VIDEO_HEIGHT}
      >
        {renderHandles()}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Checking encoder...</span>
          </div>
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      id={id}
      selected={selected}
      fullBleed
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      minWidth={340}
      minHeight={VIDEO_HEIGHT}
      aspectFitMedia={nodeData.outputVideo}
    >
      {renderHandles()}

      {/* Video preview (full-bleed) */}
      {nodeData.outputVideo ? (
        <div className="relative w-full h-full">
          <video
            ref={videoAutoplayRef}
            src={videoBlobUrl ?? undefined}
            controls
            loop
            muted
            className="absolute inset-0 w-full h-full object-contain rounded-lg"
            playsInline
          />
          <button
            onClick={() => updateNodeData(id, { outputVideo: null, status: "idle" })}
            className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors"
            title="Clear video"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-900/40 rounded-lg">
          <span className="text-[10px] text-neutral-500">Run workflow to apply ease curve</span>
        </div>
      )}

      {/* Processing overlay */}
      {nodeData.status === "loading" && (
        <div className="absolute inset-0 bg-neutral-900/70 rounded-lg flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
          <span className="text-white text-xs">Processing... {Math.round(nodeData.progress)}%</span>
        </div>
      )}

      {/* Error display */}
      {nodeData.status === "error" && nodeData.error && (
        <div className="absolute bottom-2 left-2 right-2 px-2 py-1.5 bg-red-900/30 border border-red-700/50 rounded">
          <p className="text-[10px] text-red-400 break-words">{nodeData.error}</p>
        </div>
      )}
    </BaseNode>
  );
}
