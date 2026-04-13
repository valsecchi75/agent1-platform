"use client";

/**
 * Preview Image Node
 *
 * Simple utility node that displays an image received from an upstream
 * connection. Similar to ComfyUI's "Preview Image" — accepts one image
 * input handle and renders it with optional label.
 */

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import type { PreviewImageData } from "@/types/customNodes";
import { useCallback, useEffect, useState } from "react";

type PreviewImageNodeType = Node<PreviewImageData, "previewImage">;

export function PreviewImageNode({ id, data, selected }: NodeProps<PreviewImageNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);
  const getConnectedInputs = useWorkflowStore((s) => s.getConnectedInputs);
  const [localLabel, setLocalLabel] = useState(data.label || "");

  // Auto-receive upstream image whenever edges or upstream data changes
  useEffect(() => {
    const inputs = getConnectedInputs(id);
    const img = inputs.images[0] ?? null;
    if (img !== data.image) {
      updateNodeData(id, { image: img });
    }
  }, [id, edges, nodes, getConnectedInputs, updateNodeData, data.image]);

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalLabel(e.target.value);
      updateNodeData(id, { label: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      contentClassName="flex-1 min-h-0 relative"
      aspectFitMedia={data.image}
    >
      {/* Input handle — image */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        data-handletype="image"
        style={{ top: "50%", zIndex: 10 }}
      />
      {/* Output handle — pass-through */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
        style={{ top: "50%", zIndex: 10 }}
      />

      <div className="w-full h-full flex flex-col overflow-hidden rounded-lg">
        {/* Image area — fills remaining space */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {data.image ? (
            <img
              src={data.image}
              alt={localLabel || "Preview"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-900/40 flex flex-col items-center justify-center">
              <ImageIcon className="w-8 h-8 text-neutral-600" />
              <span className="text-xs text-neutral-500 mt-2">Connect an image</span>
            </div>
          )}
        </div>

        {/* Label input — thin bottom bar */}
        <div className="shrink-0 px-2 py-1.5 border-t border-neutral-700/40 bg-neutral-800/80">
          <input
            type="text"
            value={localLabel}
            onChange={handleLabelChange}
            placeholder="Label (optional)"
            className="nodrag nopan w-full text-[11px] bg-transparent border-none rounded px-1 py-0 text-neutral-200 placeholder:text-neutral-500 focus:outline-none text-center"
          />
        </div>
      </div>
    </BaseNode>
  );
}
