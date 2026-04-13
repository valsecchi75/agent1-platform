"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Pencil, Cloud, CloudDownload, RefreshCw, CheckCircle2 } from "lucide-react";
import type { TemplatePackMeta } from "@/types/templates";

interface TemplateCardProps {
  template: TemplatePackMeta;
  isLoading?: boolean;
  isNew?: boolean;
  isInstalled?: boolean;
  onUseWorkflow: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  remoteBaseUrl?: string;
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  simple: "bg-[var(--accent)]",
  advanced: "bg-purple-500",
  production: "bg-green-500",
  experimental: "bg-orange-500",
};

export function TemplateGridCard({
  template,
  isLoading = false,
  isNew = false,
  isInstalled = false,
  onUseWorkflow,
  onDelete,
  onEdit,
  disabled = false,
  remoteBaseUrl,
}: TemplateCardProps) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animation logic for multi-frame preview
  useEffect(() => {
    if (isHovering && template.previewFrames.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % template.previewFrames.length);
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentFrameIndex(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovering, template.previewFrames.length]);

  const currentFrame = template.previewFrames[currentFrameIndex] || null;
  const previewImageUrl = currentFrame
    ? template.source === "remote" && remoteBaseUrl
      ? `${remoteBaseUrl.replace(/\/$/, "")}/templates/${template.slug}/preview/${currentFrame}`
      : `/api/templates/${template.slug}/preview/${currentFrame}`
    : null;

  return (
    <div
      className={`
        group rounded-lg overflow-hidden border transition-all flex flex-col
        ${
          isLoading
            ? "bg-[var(--accent)]/20 border-[var(--accent)]/50"
            : "bg-neutral-900/50 border-neutral-700 hover:border-neutral-600"
        }
        ${disabled && !isLoading ? "opacity-50 cursor-not-allowed" : ""}
      `}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Image Container - 4:3 aspect ratio */}
      <div
        className={`
          relative w-full overflow-hidden
          ${isLoading ? "bg-[var(--accent)]/20" : "bg-neutral-800"}
        `}
        style={{ aspectRatio: "4/3" }}
      >
        {previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentFrameIndex}
            src={previewImageUrl}
            alt={`${template.name} preview`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Category dot - top-left corner */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${CATEGORY_DOT_COLORS[template.category] || "bg-neutral-500"}`}
          />
        </div>

        {/* NEW badge - top-right corner */}
        {isNew && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
              NEW
            </span>
          </div>
        )}

        {/* Tag pills - bottom-left corner (max 2) */}
        {(template.techTags.length > 0 || template.tags.length > 0) && (
          <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap max-w-[calc(100%-1rem)]">
            {template.techTags.length > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-900/70 text-blue-200 truncate">
                {template.techTags[0]}
              </span>
            )}
            {template.tags.length > 0 && template.techTags.length === 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-700/70 text-neutral-300 truncate">
                {template.tags[0]}
              </span>
            )}
            {template.techTags.length > 0 && template.tags.length > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-700/70 text-neutral-300 truncate">
                {template.tags[0]}
              </span>
            )}
          </div>
        )}

        {/* Hover overlay with action button */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Remote not installed: Install button */}
          {template.source === "remote" && !isInstalled && (
            <button
              onClick={onUseWorkflow}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Install template"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Installing
                </>
              ) : (
                <>
                  <CloudDownload className="w-3 h-3" />
                  Install
                </>
              )}
            </button>
          )}

          {/* Remote installed or local: Use button */}
          {(template.source === "local" || (template.source === "remote" && isInstalled)) && (
            <button
              onClick={onUseWorkflow}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-primary-text)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Use template"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Loading
                </>
              ) : (
                <>
                  Use
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-3 flex flex-col flex-1 min-w-0">
        {/* Template name */}
        <h3 className="text-sm font-medium text-neutral-200 truncate mb-1">
          {template.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-neutral-400 line-clamp-2 flex-1 mb-2">
          {template.description}
        </p>

        {/* Footer: node count + source + actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-700/50">
          {/* Left: Node count */}
          <div className="flex items-center gap-1 text-neutral-400 text-xs">
            <span>
              {template.nodeCount} {template.nodeCount === 1 ? "node" : "nodes"}
            </span>
          </div>

          {/* Right: Source indicator and action buttons */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Remote indicator */}
            {template.source === "remote" && (
              <Cloud className="w-3 h-3 text-neutral-500 flex-shrink-0" />
            )}

            {/* Edit button (local only) */}
            {template.source === "local" && onEdit && (
              <button
                onClick={onEdit}
                disabled={disabled || isLoading}
                className="p-1 text-neutral-400 hover:text-neutral-300 rounded-md hover:bg-neutral-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit template"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {/* Delete button (local only) */}
            {template.source === "local" && onDelete && (
              <button
                onClick={onDelete}
                disabled={disabled || isLoading}
                className="p-1 text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete template"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}

            {/* Installed indicator (remote) */}
            {template.source === "remote" && isInstalled && (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
