"use client";

import { useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import { X, Upload, Tag, Plus } from "lucide-react";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/workflow";
import type { TemplatePack } from "@/types/templates";
import { TEMPLATE_CATEGORIES, TECH_TAG_MAP } from "@/types/templates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (slug: string) => void;
  currentNodes: WorkflowNode[];
  currentEdges: WorkflowEdge[];
  currentEdgeStyle: string;
  currentGroups?: unknown[];
  currentWorkflowName: string | null;
}

interface PreviewImage {
  id: string;
  url: string; // Data URL
  filename: string;
}

/**
 * Detects tech tags from the workflow nodes
 * Scans node types and model providers to auto-tag the template
 */
function detectTechTags(nodes: WorkflowNode[]): string[] {
  const tags = new Set<string>();

  for (const node of nodes) {
    const type = node.type;
    const data = node.data;

    // Check direct node type mapping
    if (type in TECH_TAG_MAP) {
      const mapped = TECH_TAG_MAP[type];
      if (typeof mapped === "string") {
        tags.add(mapped);
      }
    }

    // Check for model provider in node data
    if (data && typeof data === "object") {
      const nodeData = data as Record<string, unknown>;

      // Check for gemini model
      if (
        (nodeData.model && typeof nodeData.model === "string" && nodeData.model.includes("gemini")) ||
        (nodeData.provider && nodeData.provider === "google")
      ) {
        tags.add("Gemini");
      }

      // Check for fal.ai provider
      if (nodeData.selectedModel && typeof nodeData.selectedModel === "object") {
        const model = nodeData.selectedModel as Record<string, unknown>;
        if (model.provider === "fal") {
          tags.add("fal.ai");
        } else if (model.provider === "replicate") {
          tags.add("Replicate");
        }
      }

      // Check for veo model
      if (nodeData.model && typeof nodeData.model === "string" && nodeData.model.includes("veo")) {
        tags.add("Veo");
      }
    }
  }

  return Array.from(tags).sort();
}

/**
 * Generates a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Compress base64 images in workflow nodes to lightweight thumbnails.
 * Keeps images as visual reference for users loading the template,
 * but reduces them to ~512px JPEG thumbnails to keep the JSON small.
 */
async function compressNodeImages(nodes: WorkflowNode[], maxDim = 512, quality = 0.6): Promise<WorkflowNode[]> {
  // Helper: compress a single data URL, skip non-base64 and null values
  const compress = (val: unknown): Promise<unknown> => {
    if (typeof val === "string" && val.startsWith("data:image")) {
      return resizePreviewImage(val, maxDim, quality);
    }
    return Promise.resolve(val);
  };

  return Promise.all(
    nodes.map(async (node) => {
      const data = node.data as Record<string, unknown>;
      if (!data) return node;

      const cleaned = { ...data };

      // Compress single image fields
      cleaned.outputImage = await compress(cleaned.outputImage);
      cleaned.image = await compress(cleaned.image);
      cleaned.sourceImage = await compress(cleaned.sourceImage);

      // Compress inputImages array
      if (Array.isArray(cleaned.inputImages)) {
        cleaned.inputImages = await Promise.all(
          cleaned.inputImages.map((img: unknown) => compress(img))
        );
      }

      // Compress imageHistory — keep only the currently selected image (latest)
      // to avoid bloat from many carousel entries
      if (Array.isArray(cleaned.imageHistory)) {
        const history = cleaned.imageHistory as Record<string, unknown>[];
        if (history.length > 0) {
          // Keep only the last entry (most recent generation), compress it
          const latest = { ...history[history.length - 1] };
          if (typeof latest.base64 === "string" && (latest.base64 as string).startsWith("data:image")) {
            latest.base64 = await resizePreviewImage(latest.base64 as string, maxDim, quality);
          }
          cleaned.imageHistory = [latest];
          cleaned.selectedHistoryIndex = 0;
        }
      }

      // Compress outputGallery
      if (Array.isArray(cleaned.outputGallery)) {
        cleaned.outputGallery = await Promise.all(
          cleaned.outputGallery.map((img: unknown) => compress(img))
        );
      }

      // Strip blob URLs (these are runtime-only, can't be persisted)
      if (typeof cleaned.videoUrl === "string" && (cleaned.videoUrl as string).startsWith("blob:")) {
        cleaned.videoUrl = null;
      }

      return { ...node, data: cleaned };
    })
  );
}

/**
 * Resize a data URL image to a max dimension for preview thumbnails.
 * Returns a compressed JPEG data URL.
 */
function resizePreviewImage(dataUrl: string, maxDim = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original on error
    img.src = dataUrl;
  });
}

/**
 * Converts a File to a base64 data URL
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SaveAsTemplateModal({
  isOpen,
  onClose,
  onSaved,
  currentNodes,
  currentEdges,
  currentEdgeStyle,
  currentGroups,
  currentWorkflowName,
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(currentWorkflowName || "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"simple" | "advanced" | "production" | "experimental">("simple");
  const [author, setAuthor] = useState("User");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map Dialog's open prop and onOpenChange callback
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      onClose();
    }
  };

  const detectedTechTags = detectTechTags(currentNodes);
  const allTags = [...new Set([...detectedTechTags, ...customTags])];

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !allTags.includes(trimmed)) {
      setCustomTags((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  };

  const handleRemoveCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleRemovePreviewImage = (id: string) => {
    setPreviewImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const newImages: PreviewImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!validTypes.includes(file.type)) {
          setError(`File "${file.name}" is not a valid image type (jpg, png, webp)`);
          continue;
        }

        const dataUrl = await fileToDataUrl(file);
        newImages.push({
          id: `preview-${Date.now()}-${i}`,
          url: dataUrl,
          filename: file.name,
        });
      }

      setPreviewImages((prev) => [...prev, ...newImages]);
      setError(null);
    } catch (err) {
      setError(`Failed to read image file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const newImages: PreviewImage[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!validTypes.includes(file.type)) {
          setError(`File "${file.name}" is not a valid image type (jpg, png, webp)`);
          continue;
        }

        const dataUrl = await fileToDataUrl(file);
        newImages.push({
          id: `preview-${Date.now()}-${i}`,
          url: dataUrl,
          filename: file.name,
        });
      }

      setPreviewImages((prev) => [...prev, ...newImages]);
      setError(null);
    } catch (err) {
      setError(`Failed to read image file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const handleSaveTemplate = async () => {
    // Validation
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const slug = generateSlug(name);

      // Compress node images to thumbnails (512px JPEG) — keeps visual references
      // but reduces a 50MB+ workflow to ~1-2MB
      const cleanNodes = await compressNodeImages(currentNodes, 512, 0.6);

      // Compress preview images to reasonable size (800px max, JPEG quality 0.7)
      const compressedPreviews = await Promise.all(
        previewImages.map(async (img) => ({
          filename: img.filename.replace(/\.\w+$/, ".jpg"),
          data: await resizePreviewImage(img.url, 800, 0.7),
        }))
      );

      // Build template data
      const templateData = {
        name: name.trim(),
        description: description.trim(),
        category,
        tags: allTags,
        author: author.trim(),
        previewImages: compressedPreviews,
      };

      // POST to /api/templates with workflow data (images stripped)
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...templateData,
          nodes: cleanNodes,
          edges: currentEdges,
          edgeStyle: currentEdgeStyle,
          groups: currentGroups || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save template (${response.status})`);
      }

      const result = await response.json();
      onSaved(result.slug || slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow Template"
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] disabled:opacity-50 transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] disabled:opacity-50 resize-none transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] disabled:opacity-50 transition-colors"
            >
              {TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tech Tags */}
          {detectedTechTags.length > 0 && (
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Auto-Detected Tech Tags</label>
              <div className="flex flex-wrap gap-2">
                {detectedTechTags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-full"
                  >
                    <Tag size={14} className="text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Tags */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Custom Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag and press Enter"
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleAddCustomTag}
                disabled={isLoading || !customTagInput.trim()}
                className="px-3 py-2 bg-[var(--surface-3)] hover:bg-[var(--controls-hover)] disabled:opacity-50 text-[var(--text-primary)] text-sm rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus size={16} />
              </button>
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-2 px-2 py-1 bg-[var(--surface-3)] border border-[var(--border)] rounded-full"
                  >
                    <span className="text-xs text-[var(--text-secondary)]">{tag}</span>
                    <button
                      onClick={() => handleRemoveCustomTag(tag)}
                      disabled={isLoading}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="User"
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--input-focus)] disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Preview Images */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Preview Images</label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
              className="p-6 border-2 border-dashed border-[var(--input-border)] rounded-lg text-center cursor-pointer hover:border-[var(--input-focus)] hover:bg-[var(--input-bg)] transition-colors disabled:opacity-50"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={isLoading}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} className="text-[var(--text-secondary)]" />
                <p className="text-sm text-[var(--text-secondary)]">Drop images or click to upload</p>
                <p className="text-xs text-[var(--text-muted)]">JPG, PNG, WebP</p>
              </div>
            </div>

            {/* Preview Thumbnails */}
            {previewImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previewImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.url}
                      alt="Preview"
                      className="w-full h-20 object-cover rounded-lg border border-[var(--border)]"
                    />
                    <button
                      onClick={() => handleRemovePreviewImage(img.id)}
                      disabled={isLoading}
                      className="absolute top-1 right-1 p-1 bg-[var(--surface-1)]/80 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Node Count */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Node Count</label>
            <div className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-secondary)] text-sm">
              {currentNodes.length} node{currentNodes.length !== 1 ? "s" : ""}
            </div>
          </div>

        </DialogBody>

        <DialogFooter>
          <DialogButton variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            onClick={handleSaveTemplate}
            disabled={isLoading || !name.trim() || !description.trim()}
          >
            {isLoading ? "Saving..." : "Save Template"}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
