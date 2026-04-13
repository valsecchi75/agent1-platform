"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { X, Upload, Tag, ChevronDown, ChevronRight, Check } from "lucide-react";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/workflow";
import type { TemplatePack } from "@/types/templates";
import { TEMPLATE_CATEGORIES, TECH_TAG_MAP } from "@/types/templates";
import type { TemplateTag, TagGroup } from "@/types/templateTags";
import { TAG_GROUP_LABELS } from "@/types/templateTags";
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
  editingTemplate?: TemplatePack | null; // For editing existing templates
}

interface PreviewImage {
  id: string;
  url: string; // Data URL
  filename: string;
}

/**
 * Mapping from auto-detected techTag labels to taxonomy tag labels.
 * Used to auto-check taxonomy checkboxes based on detected node types.
 */
const TECH_TO_TAXONOMY_MAP: Record<string, { label: string; group: TagGroup }> = {
  "Nano Banana": { label: "Nano Banana", group: "provider" },
  "LLM": { label: "LLM", group: "generation" },
  "Video Gen": { label: "Video", group: "generation" },
  "Audio Gen": { label: "Audio", group: "generation" },
  "3D Gen": { label: "3D", group: "generation" },
  "Gemini": { label: "Gemini", group: "provider" },
  "fal.ai": { label: "fal.ai", group: "provider" },
  "Replicate": { label: "Replicate", group: "provider" },
  "Veo": { label: "Veo", group: "provider" },
};

/**
 * Detects tech tags from the workflow nodes
 */
function detectTechTags(nodes: WorkflowNode[]): string[] {
  const tags = new Set<string>();

  for (const node of nodes) {
    const type = node.type;
    const data = node.data;

    if (type in TECH_TAG_MAP) {
      const mapped = TECH_TAG_MAP[type];
      if (typeof mapped === "string") {
        tags.add(mapped);
      }
    }

    if (data && typeof data === "object") {
      const nodeData = data as Record<string, unknown>;

      if (
        (nodeData.model && typeof nodeData.model === "string" && nodeData.model.includes("gemini")) ||
        (nodeData.provider && nodeData.provider === "google")
      ) {
        tags.add("Gemini");
      }

      if (nodeData.selectedModel && typeof nodeData.selectedModel === "object") {
        const model = nodeData.selectedModel as Record<string, unknown>;
        if (model.provider === "fal") {
          tags.add("fal.ai");
        } else if (model.provider === "replicate") {
          tags.add("Replicate");
        }
      }

      if (nodeData.model && typeof nodeData.model === "string" && nodeData.model.includes("veo")) {
        tags.add("Veo");
      }
    }
  }

  return Array.from(tags).sort();
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function compressNodeImages(nodes: WorkflowNode[], maxDim = 512, quality = 0.6): Promise<WorkflowNode[]> {
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
      cleaned.outputImage = await compress(cleaned.outputImage);
      cleaned.image = await compress(cleaned.image);
      cleaned.sourceImage = await compress(cleaned.sourceImage);

      if (Array.isArray(cleaned.inputImages)) {
        cleaned.inputImages = await Promise.all(
          cleaned.inputImages.map((img: unknown) => compress(img))
        );
      }

      if (Array.isArray(cleaned.imageHistory)) {
        const history = cleaned.imageHistory as Record<string, unknown>[];
        if (history.length > 0) {
          const latest = { ...history[history.length - 1] };
          if (typeof latest.base64 === "string" && (latest.base64 as string).startsWith("data:image")) {
            latest.base64 = await resizePreviewImage(latest.base64 as string, maxDim, quality);
          }
          cleaned.imageHistory = [latest];
          cleaned.selectedHistoryIndex = 0;
        }
      }

      if (Array.isArray(cleaned.outputGallery)) {
        cleaned.outputGallery = await Promise.all(
          cleaned.outputGallery.map((img: unknown) => compress(img))
        );
      }

      if (typeof cleaned.videoUrl === "string" && (cleaned.videoUrl as string).startsWith("blob:")) {
        cleaned.videoUrl = null;
      }

      return { ...node, data: cleaned };
    })
  );
}

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
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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
  editingTemplate,
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(currentWorkflowName || "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"simple" | "advanced" | "production" | "experimental">("simple");
  const [author, setAuthor] = useState("User");
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState<string[]>([]); // Legacy/unmatched tags
  const [taxonomyTags, setTaxonomyTags] = useState<TemplateTag[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TagGroup>>(new Set());
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedTechTags = detectTechTags(currentNodes);

  // Fetch taxonomy tags on mount
  useEffect(() => {
    if (!isOpen) return;
    setTaxonomyLoading(true);
    fetch("/api/template-tags")
      .then((res) => res.json())
      .then((data) => {
        const tags = (data.tags || []) as TemplateTag[];
        setTaxonomyTags(tags);

        // Auto-select tags based on detected tech tags
        const autoSlugs = new Set<string>();
        for (const techTag of detectedTechTags) {
          const mapping = TECH_TO_TAXONOMY_MAP[techTag];
          if (mapping) {
            const found = tags.find(
              (t) => t.label === mapping.label && t.groupKey === mapping.group
            );
            if (found) autoSlugs.add(found.slug);
          }
        }

        // If we have an "Image" node type detected (nanoBanana produces images),
        // also auto-check "Image" in generation group
        if (detectedTechTags.includes("Nano Banana") || currentNodes.some(n => n.type === "nanoBanana")) {
          const imageTag = tags.find(t => t.label === "Image" && t.groupKey === "generation");
          if (imageTag) autoSlugs.add(imageTag.slug);
        }

        // If editing existing template, pre-select matching taxonomy tags
        if (editingTemplate) {
          const allExistingLabels = [
            ...(editingTemplate.tags || []),
            ...(editingTemplate.techTags || []),
            ...(editingTemplate.taskTags || []),
          ];
          const taxonomyLabels = new Set(tags.map((t) => t.label));

          for (const label of allExistingLabels) {
            const found = tags.find((t) => t.label === label);
            if (found) autoSlugs.add(found.slug);
          }

          // Preserve custom/unmatched tags
          const unmatchedTags = (editingTemplate.tags || []).filter(
            (label) => !taxonomyLabels.has(label) && !detectedTechTags.includes(label)
          );
          setCustomTags(unmatchedTags);
        }

        setSelectedTagSlugs(autoSlugs);
      })
      .catch(() => {
        setTaxonomyTags([]);
      })
      .finally(() => setTaxonomyLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Populate fields when editing
  useEffect(() => {
    if (editingTemplate && isOpen) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description);
      setCategory(editingTemplate.category);
      setAuthor(editingTemplate.author);
    }
  }, [editingTemplate, isOpen]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      onClose();
    }
  };

  // Group taxonomy tags by groupKey
  const tagsByGroup = taxonomyTags.reduce<Record<TagGroup, TemplateTag[]>>(
    (acc, tag) => {
      if (!acc[tag.groupKey]) acc[tag.groupKey] = [];
      acc[tag.groupKey].push(tag);
      return acc;
    },
    { generation: [], task: [], provider: [], style: [] }
  );

  // Determine which slugs are auto-detected (disabled checkboxes)
  const autoDetectedSlugs = new Set<string>();
  for (const techTag of detectedTechTags) {
    const mapping = TECH_TO_TAXONOMY_MAP[techTag];
    if (mapping) {
      const found = taxonomyTags.find(
        (t) => t.label === mapping.label && t.groupKey === mapping.group
      );
      if (found) autoDetectedSlugs.add(found.slug);
    }
  }
  // Also check Image auto-detect
  if (detectedTechTags.includes("Nano Banana") || currentNodes.some(n => n.type === "nanoBanana")) {
    const imageTag = taxonomyTags.find(t => t.label === "Image" && t.groupKey === "generation");
    if (imageTag) autoDetectedSlugs.add(imageTag.slug);
  }

  const handleToggleTag = (slug: string) => {
    if (autoDetectedSlugs.has(slug)) return; // Can't uncheck auto-detected
    setSelectedTagSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleGroupCollapse = (group: TagGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Unmatched detected tech tags that don't map to any taxonomy entry
  const unmatchedTechTags = detectedTechTags.filter((tag) => !TECH_TO_TAXONOMY_MAP[tag]);

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
        newImages.push({ id: `preview-${Date.now()}-${i}`, url: dataUrl, filename: file.name });
      }
      setPreviewImages((prev) => [...prev, ...newImages]);
      setError(null);
    } catch (err) {
      setError(`Failed to read image file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        newImages.push({ id: `preview-${Date.now()}-${i}`, url: dataUrl, filename: file.name });
      }
      setPreviewImages((prev) => [...prev, ...newImages]);
      setError(null);
    } catch (err) {
      setError(`Failed to read image file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSaveTemplate = async () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }

    setIsLoading(true);
    setError(null);

    try {
      const slug = generateSlug(name);
      const cleanNodes = await compressNodeImages(currentNodes, 512, 0.6);
      const compressedPreviews = await Promise.all(
        previewImages.map(async (img) => ({
          filename: img.filename.replace(/\.\w+$/, ".jpg"),
          data: await resizePreviewImage(img.url, 800, 0.7),
        }))
      );

      // Build tag arrays from selected taxonomy slugs
      const selectedLabels: string[] = [];
      const taskTagLabels: string[] = [];

      for (const slug of selectedTagSlugs) {
        const tag = taxonomyTags.find((t) => t.slug === slug);
        if (tag) {
          selectedLabels.push(tag.label);
          if (tag.groupKey === "task" || tag.groupKey === "style") {
            taskTagLabels.push(tag.label);
          }
        }
      }

      // Union of all labels (taxonomy + custom + unmatched tech) for backward compat
      const allTags = [...new Set([...selectedLabels, ...customTags, ...unmatchedTechTags])];

      const templateData = {
        name: name.trim(),
        description: description.trim(),
        category,
        tags: allTags,
        taskTags: taskTagLabels,
        author: author.trim(),
        previewImages: compressedPreviews,
      };

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const groupOrder: TagGroup[] = ["generation", "task", "provider", "style"];

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

          {/* Tag Taxonomy Selector */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Tags</label>
            {taxonomyLoading ? (
              <div className="text-xs text-[var(--text-muted)] py-2">Loading tags...</div>
            ) : (
              <div className="space-y-2">
                {groupOrder.map((group) => {
                  const groupTags = tagsByGroup[group] || [];
                  if (groupTags.length === 0) return null;
                  const isCollapsed = collapsedGroups.has(group);

                  return (
                    <div key={group} className="border border-[var(--border)] rounded-lg overflow-hidden">
                      {/* Group header */}
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors text-left"
                      >
                        {isCollapsed ? (
                          <ChevronRight size={14} className="text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown size={14} className="text-[var(--text-muted)]" />
                        )}
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {TAG_GROUP_LABELS[group]}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                          {groupTags.filter((t) => selectedTagSlugs.has(t.slug)).length}/{groupTags.length}
                        </span>
                      </button>

                      {/* Tag checkboxes */}
                      {!isCollapsed && (
                        <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
                          {groupTags.map((tag) => {
                            const isChecked = selectedTagSlugs.has(tag.slug);
                            const isAutoDetected = autoDetectedSlugs.has(tag.slug);

                            return (
                              <label
                                key={tag.id}
                                className={`flex items-center gap-2 py-1 cursor-pointer text-xs ${
                                  isAutoDetected ? "opacity-70" : ""
                                }`}
                              >
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleToggleTag(tag.slug);
                                  }}
                                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isChecked
                                      ? "bg-[var(--accent)] border-[var(--accent)]"
                                      : "border-[var(--border)] bg-[var(--surface-1)]"
                                  } ${isAutoDetected ? "cursor-not-allowed" : "cursor-pointer hover:border-[var(--accent)]"}`}
                                >
                                  {isChecked && <Check size={12} className="text-white" />}
                                </div>
                                <span className="text-[var(--text-primary)] truncate">{tag.label}</span>
                                {isAutoDetected && (
                                  <span className="text-[9px] text-[var(--text-muted)] ml-auto flex-shrink-0">auto</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unmatched auto-detected tech tags (no taxonomy entry) */}
            {unmatchedTechTags.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] text-[var(--text-muted)]">Auto-detected (no taxonomy match):</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {unmatchedTechTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-secondary)]"
                    >
                      <Tag size={10} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy custom tags (from existing template, read-only) */}
            {customTags.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] text-[var(--text-muted)]">Custom tags (preserved):</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {customTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-3)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
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
