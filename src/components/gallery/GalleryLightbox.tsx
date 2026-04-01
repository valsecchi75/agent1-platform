"use client";

import {
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  Download,
  Copy,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DbGeneration } from "@/lib/db-types";

interface GalleryLightboxProps {
  generation: DbGeneration | null;
  onClose: () => void;
  onLoveToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function GalleryLightbox({
  generation,
  onClose,
  onLoveToggle,
  onDelete,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: GalleryLightboxProps) {
  const isOpen = generation !== null;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onClose, onPrev, onNext]);

  if (!generation) return null;

  const mediaUrl = `/api/db/media/${generation.file_path}`;
  const isVideo = generation.file_type === "video";
  const isLoved = generation.is_loved === 1;
  const hasWorkflow = !!generation.workflow_json;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = generation.file_path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generation.prompt || "");
    } catch {
      console.warn("Clipboard not available");
    }
  };

  const handleOpenWorkflow = () => {
    if (generation.workflow_json) {
      try {
        sessionStorage.setItem("workflowToLoad", generation.workflow_json);
        window.location.href = "/";
      } catch (e) {
        console.error("Failed to open workflow:", e);
        alert("Could not open workflow. Storage may be full or unavailable.");
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this generation?")) {
      onDelete(generation.id);
      onClose();
    }
  };

  const costDisplay = generation.cost_usd > 0 ? `$${generation.cost_usd.toFixed(3)}` : "Free";
  const createdDate = new Date(generation.created_at).toLocaleString();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 border-0 gap-0 [&>button:last-child]:hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Generation Details</DialogTitle>
        <TooltipProvider delayDuration={300}>
        <div className="flex gap-4 h-[95vh]">
          {/* Left: Media viewer */}
          <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 relative">
            {/* Navigation arrows */}
            {hasPrev && (
              <button
                onClick={onPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-neutral-50/20 hover:bg-neutral-50/30 transition-all z-10"
                title="Previous (←)"
              >
                <ChevronLeft className="w-6 h-6 text-neutral-50" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={onNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-neutral-50/20 hover:bg-neutral-50/30 transition-all z-10"
                title="Next (→)"
              >
                <ChevronRight className="w-6 h-6 text-neutral-50" />
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-full bg-neutral-50/20 hover:bg-neutral-50/30 transition-all z-10"
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-neutral-50" />
            </button>

            {/* Media */}
            {isVideo ? (
              <video
                src={mediaUrl}
                controls
                className="max-w-[95vw] max-h-[95vh] object-contain"
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Generation"
                className="max-w-[95vw] max-h-[95vh] object-contain"
              />
            )}
          </div>

          {/* Right: Sidebar */}
          <div
            className="w-80 flex flex-col"
            style={{ background: "var(--surface-1)", borderLeft: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Details
              </h2>
            </div>

            {/* Action buttons */}
            <div className="px-4 py-3 flex gap-2 border-b" style={{ borderColor: "var(--border)" }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onLoveToggle(generation.id)}
                    className="flex-1"
                    style={{
                      background: isLoved ? "var(--accent)" : "var(--surface-2)",
                      color: isLoved ? "black" : "var(--text-primary)",
                    }}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={isLoved ? "currentColor" : "none"}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isLoved ? "Remove from favorites" : "Add to favorites"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    className="flex-1"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyPrompt}
                    className="flex-1"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy prompt</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    className="flex-1"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>

            {/* Open Workflow button */}
            {hasWorkflow && (
              <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <Button
                  onClick={handleOpenWorkflow}
                  className="w-full"
                  style={{
                    background: "var(--accent)",
                    color: "black",
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Workflow
                </Button>
              </div>
            )}

            {/* Metadata */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Prompt */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Prompt
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {generation.prompt || "(empty)"}
                </p>
              </div>

              {/* Model & Provider */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Model
                </p>
                <p className="text-sm font-mono" style={{ color: "var(--accent)" }}>
                  {generation.model}
                </p>
              </div>

              {/* Provider */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Provider
                </p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {generation.provider}
                </p>
              </div>

              {/* Resolution & AR */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Resolution
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {generation.resolution}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Aspect Ratio
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {generation.aspect_ratio}
                  </p>
                </div>
              </div>

              {/* Seed */}
              {generation.seed && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Seed
                  </p>
                  <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
                    {generation.seed}
                  </p>
                </div>
              )}

              {/* Cost */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Cost
                </p>
                <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                  {costDisplay}
                </p>
              </div>

              {/* Workflow Name */}
              {generation.workflow_name && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Workflow
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {generation.workflow_name}
                  </p>
                </div>
              )}

              {/* Created */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Created
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {createdDate}
                </p>
              </div>
            </div>
          </div>
        </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
