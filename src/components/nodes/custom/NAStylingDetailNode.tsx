"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { BaseNode } from "../BaseNode";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useWorkflowStore } from "@/store/workflowStore";
import type { NAStylingDetailData } from "@/types/customNodes";

type StylingDetailNodeType = Node<NAStylingDetailData, "naStylingDetail">;

export function NAStylingDetailNode({ id, data, selected }: NodeProps<StylingDetailNodeType>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const adaptiveImage = useAdaptiveImageSrc(data.outputImage, id);
  const isLoading = data.status === "loading";
  const hasError = data.status === "error";

  return (
    <BaseNode id={id} selected={selected} isExecuting={isLoading} hasError={hasError} fullBleed aspectFitMedia={data.outputImage}>
      {/* Input handles + external labels */}
      <Handle type="target" position={Position.Left} id="garment_image" style={{ top: "35%", zIndex: 10 }} data-handletype="image" isConnectable={true} />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(35% - 7px)", color: "var(--handle-color-image)", zIndex: 10 }}>Garment</div>

      <Handle type="target" position={Position.Left} id="detail_reference_image" style={{ top: "65%", zIndex: 10 }} data-handletype="image" isConnectable={true} />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(65% - 7px)", color: "var(--handle-color-image)", opacity: 0.6, zIndex: 10 }}>Detail Ref</div>

      {/* Output handles + external labels */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: "25%", zIndex: 10 }} data-handletype="image" />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(25% - 7px)", color: "var(--handle-color-image)", zIndex: 10 }}>Image</div>

      <Handle type="source" position={Position.Right} id="prompt" style={{ top: "45%", zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(45% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>Prompt</div>

      <Handle type="source" position={Position.Right} id="log" style={{ top: "65%", zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(65% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>Log</div>

      <Handle type="source" position={Position.Right} id="output_json" style={{ top: "85%", zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(85% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>JSON</div>

      {/* Preview */}
      <div className="relative w-full h-full min-h-0 overflow-hidden rounded-lg">
        {data.outputImage ? (
          <>
            <img src={adaptiveImage ?? undefined} alt="Generated" className="w-full h-full object-cover" />
            {isLoading && <div className="absolute inset-0 bg-neutral-900/70 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
            {hasError && <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center gap-1"><AlertTriangle className="w-6 h-6 text-white" /><span className="text-white text-xs">Failed</span></div>}
            <div className="absolute top-1 right-1">
              <button onClick={() => updateNodeData(id, { outputImage: null })} className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors" title="Clear"><X className="w-3 h-3" /></button>
            </div>
          </>
        ) : (
          <div className="w-full h-full min-h-[112px] bg-neutral-900/40 flex flex-col items-center justify-center">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> :
             hasError ? <span className="text-[10px] text-red-400 text-center px-2">{data.error}</span> :
             <span className="text-neutral-500 text-[10px]">Run to generate</span>}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
