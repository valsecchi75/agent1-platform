"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { BaseNode } from "../BaseNode";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useWorkflowStore } from "@/store/workflowStore";
import type { NASketchToPhotoData } from "@/types/customNodes";

type SketchToPhotoNodeType = Node<NASketchToPhotoData, "naSketchToPhoto">;

const IMAGE_INPUTS = [
  { id: "talent_image", label: "Talent" },
  { id: "flat_sketch_image", label: "Flat Sketch" },
  { id: "material_image", label: "Material" },
  { id: "pattern_image", label: "Pattern" },
  { id: "template_master_1", label: "Template 1" },
  { id: "template_master_2", label: "Template 2" },
];

const OUTPUT_HANDLES = [
  { id: "image", label: "Image", type: "image" as const },
  { id: "log", label: "Log", type: "text" as const },
  { id: "flash_request_json", label: "Flash JSON", type: "text" as const },
  { id: "nanobana_request_json", label: "NB JSON", type: "text" as const },
];

export function NASketchToPhotoNode({ id, data, selected }: NodeProps<SketchToPhotoNodeType>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const adaptiveImage = useAdaptiveImageSrc(data.outputImage, id);
  const isLoading = data.status === "loading";
  const hasError = data.status === "error";

  return (
    <BaseNode id={id} selected={selected} isExecuting={isLoading} hasError={hasError} fullBleed aspectFitMedia={data.outputImage}>
      {/* Input handles + external labels */}
      {IMAGE_INPUTS.map((input, i) => (
        <div key={input.id}>
          <Handle type="target" position={Position.Left} id={input.id}
            style={{ top: `${15 + i * 12}%`, zIndex: 10 }} data-handletype="image" isConnectable={true} />
          <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
            style={{ right: "calc(100% + 8px)", top: `calc(${15 + i * 12}% - 7px)`, color: "var(--handle-color-image)", opacity: 0.8, zIndex: 10 }}>
            {input.label}
          </div>
        </div>
      ))}

      {/* Output handles + external labels */}
      {OUTPUT_HANDLES.map((output, i) => (
        <div key={output.id}>
          <Handle type="source" position={Position.Right} id={output.id}
            style={{ top: `${20 + i * 20}%`, zIndex: 10 }} data-handletype={output.type} />
          <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
            style={{ left: "calc(100% + 8px)", top: `calc(${20 + i * 20}% - 7px)`,
              color: output.type === "image" ? "var(--handle-color-image)" : "var(--handle-color-text)", zIndex: 10 }}>
            {output.label}
          </div>
        </div>
      ))}

      {/* Preview area — fullBleed */}
      <div className="relative w-full h-full min-h-0 overflow-hidden rounded-lg bg-[var(--node-bg,#1a1a1a)]">
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
          <div className="w-full h-full min-h-[112px] bg-neutral-900 flex flex-col items-center justify-center">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> :
             hasError ? <span className="text-[10px] text-red-400 text-center px-2">{data.error}</span> :
             <span className="text-neutral-500 text-[10px]">Run to generate</span>}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
