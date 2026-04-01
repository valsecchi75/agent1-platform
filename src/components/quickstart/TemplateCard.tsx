"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Pencil, Cloud, CloudDownload, RefreshCw, CheckCircle2 } from "lucide-react";
import type { TemplatePackMeta } from "@/types/templates";

interface TemplateCardProps {
  template: TemplatePackMeta;
  isLoading?: boolean;
  isNew?: boolean; // Show "New" badge for recently added remote templates
  isInstalled?: boolean; // Remote template already installed locally
  onUseWorkflow: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  remoteBaseUrl?: string; // For remote templates: base URL to resolve preview images
}

const CATEGORY_LABELS: Record<string, string> = {
  simple: "Simple",
  advanced: "Advanced",
  production: "Production",
  experimental: "Experimental",
};

const CATEGORY_COLORS: Record<string, string> = {
  simple: "bg-[var(--accent)]/20 text-[var(--accent)]",
  advanced: "bg-purple-500/20 text-purple-300",
  production: "bg-green-500/20 text-green-300",
  experimental: "bg-orange-500/20 text-orange-300",
};

export function TemplateCard({
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
        group w-full rounded-lg border p-4 transition-all flex gap-4
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
      {/* Thumbnail - Left side (square) */}
      <div
        className={`
          w-36 h-36 flex-shrink-0 rounded-lg overflow-hidden relative
          ${
            isLoading
              ? "bg-[var(--accent)]/20"
              : "bg-neutral-800"
          }
        `}
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
      </div>

      {/* Content - Right side */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-medium text-neutral-200 truncate">
              {template.name}
            </h3>
            {isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0 animate-pulse">
                NEW
              </span>
            )}
          </div>
          <span
            className={`
              inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0
              ${CATEGORY_COLORS[template.category] || "bg-neutral-700/30 text-neutral-400"}
            `}
          >
            {CATEGORY_LABELS[template.category] || template.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-neutral-400 line-clamp-2 flex-1">
          {template.description}
        </p>

        {/* Tech tags, custom tags, and node count */}
        <div className="flex flex-wrap gap-1 mt-2 mb-3">
          {/* Tech tags */}
          {template.techTags.map((tag) => (
            <span
              key={`tech-${tag}`}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300"
            >
              {tag}
            </span>
          ))}
          {/* Custom tags */}
          {template.tags.map((tag) => (
            <span
              key={`tag-${tag}`}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-700/30 text-neutral-400"
            >
              {tag}
            </span>
          ))}
          {/* Node count */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-700/50 text-neutral-400">
            {template.nodeCount} nodes
          </span>
        </div>

        {/* Action row */}
        <div className="flex justify-between items-center gap-2">
          {/* Left: Remote indicator */}
          {template.source === "remote" && (
            <div className="flex items-center gap-1 text-neutral-500">
              <Cloud className="w-3 h-3" />
              <span className="text-[10px]">Remote</span>
            </div>
          )}

          {/* Right: Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Edit button (local only) */}
            {template.source === "local" && onEdit && (
              <button
                onClick={onEdit}
                disabled={disabled || isLoading}
                className="p-1.5 text-neutral-400 hover:text-neutral-300 rounded-md hover:bg-neutral-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit template"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete button (local only) */}
            {template.source === "local" && onDelete && (
              <button
                onClick={onDelete}
                disabled={disabled || isLoading}
                className="p-1.5 text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete template"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Install button (remote, not installed) */}
            {template.source === "remote" && !isInstalled && (
              <button
                onClick={onUseWorkflow}
                disabled={disabled || isLoading}
                className="px-2 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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

            {/* Installed remote: show Use button */}
            {template.source === "remote" && isInstalled && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" title="Installed" />
                <button
                  onClick={onUseWorkflow}
                  disabled={disabled || isLoading}
                  className="px-2 py-1 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-primary-text)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
              </div>
            )}

            {/* Use/Load button (local) */}
            {template.source === "local" && (
              <button
                onClick={onUseWorkflow}
                disabled={disabled || isLoading}
                className="px-2 py-1 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-primary-text)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
      </div>
    </div>
  );
}
