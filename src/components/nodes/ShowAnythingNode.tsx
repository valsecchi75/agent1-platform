"use client";

/**
 * Show Anything Node
 *
 * Universal preview node inspired by ComfyUI's "easy showAnything".
 * Accepts any input (image, text, video, audio, JSON) via a single
 * "anything" handle and renders the content with auto-detection.
 */

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Eye } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import type { ShowAnythingData } from "@/types/customNodes";
import { useEffect, useMemo } from "react";

type ShowAnythingNodeType = Node<ShowAnythingData, "showAnything">;

/** Detect content type from a string value */
function detectContentType(value: string | null): ShowAnythingData["contentType"] {
  if (!value) return "unknown";
  if (value.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)) return "image";
  if (value.startsWith("data:video/") || /\.(mp4|webm|mov)(\?|$)/i.test(value)) return "video";
  if (value.startsWith("data:audio/") || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(value)) return "audio";
  // Try JSON detection
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { JSON.parse(trimmed); return "json"; } catch { /* not json */ }
  }
  return "text";
}

export function ShowAnythingNode({ id, data, selected }: NodeProps<ShowAnythingNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);
  const getConnectedInputs = useWorkflowStore((s) => s.getConnectedInputs);

  // Auto-receive upstream content whenever edges or upstream data changes
  useEffect(() => {
    const inputs = getConnectedInputs(id);
    // Take whatever comes in: image first, then text, then video, then audio
    const content =
      inputs.images[0] ?? inputs.text ?? inputs.videos[0] ?? inputs.audio[0] ?? null;
    if (content !== data.content) {
      const contentType = detectContentType(content);
      updateNodeData(id, { content, contentType });
    }
  }, [id, edges, nodes, getConnectedInputs, updateNodeData, data.content]);

  // Format JSON for display
  const displayContent = useMemo(() => {
    if (data.contentType === "json" && data.content) {
      try {
        return JSON.stringify(JSON.parse(data.content), null, 2);
      } catch { return data.content; }
    }
    return data.content;
  }, [data.content, data.contentType]);

  // Pass-through: output whatever came in
  const outputHandle = data.contentType === "image" ? "image" : "text";

  return (
    <BaseNode id={id} selected={selected}>
      {/* Input handle — anything */}
      <Handle
        type="target"
        position={Position.Left}
        id="anything"
        style={{ top: "50%" }}
      />

      {/* Output handle — pass-through */}
      <Handle
        type="source"
        position={Position.Right}
        id={outputHandle}
        style={{ top: "50%" }}
        data-handletype={outputHandle}
      />

      <div className="flex flex-col gap-2 p-3" style={{ width: 350 }}>
        {/* Content type badge */}
        {data.contentType !== "unknown" && (
          <div className="flex justify-center">
            <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
              {data.contentType}
            </span>
          </div>
        )}

        {/* Content display */}
        <div
          className="relative w-full rounded-lg overflow-hidden"
          style={{
            minHeight: 100,
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          {!data.content ? (
            <div className="flex flex-col items-center justify-center py-10 text-neutral-600">
              <Eye className="w-8 h-8 mb-2 opacity-40" />
              <span className="text-[11px]">Connect anything</span>
            </div>
          ) : data.contentType === "image" ? (
            <img
              src={data.content}
              alt="Preview"
              className="w-full h-auto object-contain"
              style={{ maxHeight: 400 }}
            />
          ) : data.contentType === "video" ? (
            <video
              src={data.content}
              controls
              className="w-full h-auto"
              style={{ maxHeight: 300 }}
            />
          ) : data.contentType === "audio" ? (
            <div className="p-4">
              <audio src={data.content} controls className="w-full" />
            </div>
          ) : (
            /* text or json */
            <div
              className="p-3 text-[11px] text-neutral-200 whitespace-pre-wrap break-words overflow-y-auto font-mono nodrag nopan"
              style={{ maxHeight: 400 }}
            >
              {displayContent}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
}
