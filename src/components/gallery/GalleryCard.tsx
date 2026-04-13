"use client";

import { Heart, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { DbGeneration } from "@/lib/db-types";

interface GalleryCardProps {
  generation: DbGeneration;
  onLoveToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenLightbox: (generation: DbGeneration) => void;
}

export function GalleryCard({
  generation,
  onLoveToggle,
  onDelete,
  onOpenLightbox,
}: GalleryCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  const mediaUrl = `/api/db/media/${generation.file_path}`;
  const isVideo = generation.file_type === "video";
  const isLoved = generation.is_loved === 1;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = generation.file_path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLoveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLoveToggle(generation.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(generation.id);
  };

  const modelShortName = (generation.model || "unknown").split("-").slice(0, 2).join("-");
  const costDisplay = generation.cost_usd > 0 ? `$${generation.cost_usd.toFixed(2)}` : "Free";

  return (
    <div
      className="break-inside-avoid mb-3 rounded-lg overflow-hidden cursor-pointer bg-neutral-800"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onOpenLightbox(generation)}
    >
      {/* Media container */}
      <div className="relative bg-neutral-900 aspect-auto">
        {isVideo ? (
          <>
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              preload="metadata"
            />
            {isHovering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="w-12 h-12 rounded-full bg-neutral-50/30 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-6 border-l-neutral-50 border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img
            src={mediaUrl}
            alt="Generation"
            className="w-full h-full object-cover"
          />
        )}

        {/* Hover overlay */}
        {isHovering && (
          <div
            className="absolute inset-0 flex flex-col justify-between p-3"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)",
            }}
          >
            {/* Top-right action buttons */}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleLoveToggle}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isLoved ? "var(--accent)" : "rgba(255,255,255,0.2)",
                  color: isLoved ? "black" : "white",
                }}
                title={isLoved ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart
                  className="w-4 h-4"
                  fill={isLoved ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={handleDownload}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-50/20 hover:bg-neutral-50/30 transition-all"
                title="Download"
              >
                <Download className="w-4 h-4 text-neutral-50" />
              </button>
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-50/20 hover:bg-neutral-50/30 transition-all"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-neutral-50" />
              </button>
            </div>

            {/* Bottom badges */}
            <div className="flex gap-2 justify-between">
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text-primary)",
                }}
              >
                {modelShortName}
              </span>
              <div className="flex gap-2">
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--text-primary)",
                  }}
                >
                  {generation.resolution}
                </span>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--text-primary)",
                  }}
                >
                  {costDisplay}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
