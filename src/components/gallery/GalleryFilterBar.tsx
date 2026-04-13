"use client";

import { Images, Film, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenerationFilters } from "@/lib/db-types";

interface GalleryFilterBarProps {
  filters: GenerationFilters;
  onFiltersChange: (filters: GenerationFilters) => void;
  totalCount: number;
  totalCost: number;
  providers: string[];
  models: string[];
  showLovedFilter?: boolean;
}

export function GalleryFilterBar({
  filters,
  onFiltersChange,
  totalCount,
  totalCost,
  providers,
  models,
  showLovedFilter = true,
}: GalleryFilterBarProps) {
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      provider: e.target.value || undefined,
      model: undefined, // Reset model when provider changes
      offset: 0,
    });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      model: e.target.value || undefined,
      offset: 0,
    });
  };

  const handleMediaTypeChange = (type: "all" | "image" | "video") => {
    onFiltersChange({
      ...filters,
      fileType: type === "all" ? undefined : type,
      offset: 0,
    });
  };

  const filteredModels = filters.provider
    ? models.filter((m) => m.startsWith(filters.provider!))
    : models;

  return (
    <div
      className="sticky top-0 z-20 h-12 flex items-center justify-between gap-4 px-4 py-3"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left: Filters */}
      <div className="flex items-center gap-3">
        {/* Provider dropdown */}
        <select
          value={filters.provider || ""}
          onChange={handleProviderChange}
          className="px-2 py-1 text-sm rounded"
          style={{
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Model dropdown */}
        <select
          value={filters.model || ""}
          onChange={handleModelChange}
          disabled={!filters.provider}
          className="px-2 py-1 text-sm rounded"
          style={{
            background: "var(--surface-1)",
            color: filters.provider ? "var(--text-primary)" : "var(--text-secondary)",
            border: "1px solid var(--border)",
            opacity: filters.provider ? 1 : 0.5,
          }}
        >
          <option value="">All Models</option>
          {filteredModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Media type toggles */}
        <div className="flex items-center gap-1 ml-2 border-l border-neutral-700/30 pl-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMediaTypeChange("all")}
            className="h-8 w-8"
            style={{
              background: !filters.fileType ? "var(--accent-subtle)" : "transparent",
              color: !filters.fileType ? "var(--accent)" : "var(--text-secondary)",
            }}
            title="All media types"
          >
            <Layers className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMediaTypeChange("image")}
            className="h-8 w-8"
            style={{
              background: filters.fileType === "image" ? "var(--accent-subtle)" : "transparent",
              color: filters.fileType === "image" ? "var(--accent)" : "var(--text-secondary)",
            }}
            title="Images only"
          >
            <Images className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMediaTypeChange("video")}
            className="h-8 w-8"
            style={{
              background: filters.fileType === "video" ? "var(--accent-subtle)" : "transparent",
              color: filters.fileType === "video" ? "var(--accent)" : "var(--text-secondary)",
            }}
            title="Videos only"
          >
            <Film className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Right: Count + Cost */}
      <div className="flex items-center gap-3 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>
          {totalCount} generation{totalCount !== 1 ? "s" : ""}
        </span>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <span style={{ color: "var(--text-secondary)" }}>
          ${totalCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
