"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { X, Upload, HelpCircle } from "lucide-react";
import { useCallback, useRef } from "react";
import { BaseNode } from "./BaseNode";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageInputNodeData } from "@/types";

type ImageInputNodeType = Node<ImageInputNodeData, "imageInput">;
// bg-white on form inputs handled separately

export function ImageInputNode({ id, data, selected }: NodeProps<ImageInputNodeType>) {
  const nodeData = data;
  const adaptiveImage = useAdaptiveImageSrc(nodeData.image, id);
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        alert("Unsupported format. Use PNG, JPG, or WebP.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Maximum size is 10MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Update node immediately with base64 for instant preview
          updateNodeData(id, {
            image: base64,
            imageRef: undefined,
            storagePath: undefined,
            filename: file.name,
            dimensions: { width: img.width, height: img.height },
          });

          // Also save to storage/input/ for cross-session persistence
          fetch("/api/input-image-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: base64 }),
          })
            .then((res) => res.json())
            .then((result) => {
              if (result.success && result.storagePath) {
                // Store the persistent path so the image survives session reload
                updateNodeData(id, { storagePath: result.storagePath });
              }
            })
            .catch((err) => {
              console.warn("[ImageInput] Failed to save to storage:", err);
            });
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      image: null,
      imageRef: undefined,
      filename: null,
      dimensions: null,
    });
  }, [id, updateNodeData]);

  return (
    <BaseNode
      id={id}
      selected={selected}
      contentClassName="flex-1 min-h-0 overflow-visible"
      aspectFitMedia={nodeData.image}
      fullBleed
    >
      {/* Optional toggle button */}
      <button
        type="button"
        onClick={() => updateNodeData(id, { isOptional: !nodeData.isOptional })}
        className={`nodrag nopan absolute top-1 left-1 z-20 w-5 h-5 flex items-center justify-center rounded transition-colors ${
          nodeData.isOptional
            ? "text-amber-400 hover:text-amber-300"
            : "text-neutral-600 hover:text-neutral-400"
        }`}
        title={nodeData.isOptional ? "Optional: empty is allowed (click to make required)" : "Required: click to mark as optional"}
      >
        <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
      {/* Reference input handle for visual links from Split Grid node */}
      <Handle
        type="target"
        position={Position.Left}
        id="reference"
        data-handletype="reference"
        style={{ top: "20%", zIndex: 10 }}
      />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(20% - 7px)", color: "var(--handle-color-image)", opacity: 0.5, zIndex: 10 }}>
        Reference
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {nodeData.image ? (
        <div className="relative group w-full h-full">
          <img
            src={adaptiveImage ?? undefined}
            alt={nodeData.filename || "Uploaded image"}
            className="w-full h-full object-cover rounded-lg"
          />
          <button
            onClick={handleRemove}
            aria-label="Remove image"
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 focus:ring-1 focus:ring-red-400 transition-all flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload image"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full h-full bg-neutral-900/40 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-900/60 transition-colors"
        >
          <Upload className="w-8 h-8 text-neutral-600" />
          <span className="text-xs text-neutral-500 mt-2">Drop image</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
        style={{ top: "50%", zIndex: 10 }}
      />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "var(--handle-color-image)", zIndex: 10 }}>
        Image
      </div>
    </BaseNode>
  );
}
