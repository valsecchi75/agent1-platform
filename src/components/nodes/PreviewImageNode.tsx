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
import { useCallback, useEffect, useRef, useState } from "react";

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
    <BaseNode id={id} selected={selected}>
      {/* Input handle — image */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "50%" }}
        data-handletype="image"
      />

      {/* Output handle — pass-through */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "50%" }}
        data-handletype="image"
      />

      <div className="flex flex-col gap-2 p-3" style={{ width: 290 }}>
        {/* Image display */}
        <div
          className="relative w-full rounded-lg bg-neutral-900/60 overflow-hidden flex items-center justify-center"
          style={{ minHeight: 200 }}
        >
          {data.image ? (
            <img
              src={data.image}
              alt={localLabel || "Preview"}
              className="w-full h-auto object-contain rounded-lg"
              style={{ maxHeight: 400 }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
              <ImageIcon className="w-10 h-10 mb-2" />
              <span className="text-[11px]">Connect an image</span>
            </div>
          )}
        </div>

        {/* Optional label */}
        <input
          type="text"
          value={localLabel}
          onChange={handleLabelChange}
          placeholder="Label (optional)"
          className="nodrag nopan w-full text-[11px] bg-neutral-800/60 border border-neutral-700/40 rounded px-2 py-1 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 text-center"
        />
      </div>
    </BaseNode>
  );
}
