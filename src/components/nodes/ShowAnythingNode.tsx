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

/** Per-type badge color pair */
const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  image: { bg: "bg-emerald-900/60", text: "text-emerald-300" },
  video: { bg: "bg-blue-900/60",    text: "text-blue-300"    },
  audio: { bg: "bg-violet-900/60",  text: "text-violet-300"  },
  text:  { bg: "bg-neutral-700/60", text: "text-neutral-300" },
  json:  { bg: "bg-amber-900/60",   text: "text-amber-300"   },
};

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
  const badge = TYPE_BADGE[data.contentType];

  return (
    <BaseNode
      id={id}
      selected={selected}
      contentClassName="flex-1 min-h-0 relative"
    >
      {/* Input handle — anything */}
      <Handle
        type="target"
        position={Position.Left}
        id="anything"
        style={{ top: "50%", zIndex: 10 }}
      />
      {/* Output handle — pass-through */}
      <Handle
        type="source"
        position={Position.Right}
        id={outputHandle}
        data-handletype={outputHandle}
        style={{ top: "50%", zIndex: 10 }}
      />

      <div className="w-full h-full flex flex-col overflow-hidden rounded-lg">
        {/* Content area — fills remaining space */}
        <div className="flex-1 min-h-0 relative overflow-hidden bg-neutral-900/40">
          {!data.content ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Eye className="w-8 h-8 text-neutral-600 opacity-50" />
              <span className="text-xs text-neutral-500 mt-2">Connect anything</span>
            </div>
          ) : data.contentType === "image" ? (
            <img
              src={data.content}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : data.contentType === "video" ? (
            <video
              src={data.content}
              controls
              className="w-full h-full"
            />
          ) : data.contentType === "audio" ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <audio src={data.content} controls className="w-full rounded" />
            </div>
          ) : (
            /* text or json */
            <div className="p-3 text-[11px] text-neutral-200 whitespace-pre-wrap break-words overflow-y-auto font-mono nodrag nopan nowheel h-full">
              {displayContent}
            </div>
          )}
        </div>

        {/* Bottom status bar — content-type badge */}
        {badge && (
          <div className="shrink-0 px-2 py-1 border-t border-neutral-700/40 bg-neutral-800/80 flex items-center gap-1.5">
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
              {data.contentType}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
