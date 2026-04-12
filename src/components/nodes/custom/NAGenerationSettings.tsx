"use client";

import { SlidersHorizontal } from "lucide-react";
import { NA_IMAGE_MODELS, NA_ASPECT_RATIOS, NA_RESOLUTIONS } from "@/types/customNodes";

interface NAGenerationSettingsProps {
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
  onUpdate: (key: string, value: string | number) => void;
  compact?: boolean;
}

/**
 * Shared generation settings panel used by all Neural Atelier nodes.
 */
export function NAGenerationSettings({
  imageModel,
  aspectRatio,
  resolution,
  topP,
  onUpdate,
  compact = false,
}: NAGenerationSettingsProps) {
  const selectClass =
    "nodrag nopan w-full bg-neutral-900/50 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-600";

  return (
    <div className={`space-y-2 ${compact ? "mt-2" : "mt-3"}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
        <SlidersHorizontal className="w-3 h-3" />
        Generation
      </div>

      <div>
        <label className="text-[10px] text-neutral-500 block mb-0.5">Model</label>
        <select
          value={imageModel}
          onChange={(e) => onUpdate("imageModel", e.target.value)}
          className={selectClass}
        >
          {NA_IMAGE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-neutral-500 block mb-0.5">Aspect</label>
          <select value={aspectRatio} onChange={(e) => onUpdate("aspectRatio", e.target.value)} className={selectClass}>
            {NA_ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-neutral-500 block mb-0.5">Resolution</label>
          <select value={resolution} onChange={(e) => onUpdate("resolution", e.target.value)} className={selectClass}>
            {NA_RESOLUTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-neutral-500">top_p</label>
          <span className="text-[10px] text-neutral-400 font-mono">{topP.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={topP}
          onChange={(e) => onUpdate("topP", parseFloat(e.target.value))}
          className="nodrag nopan w-full h-1.5 accent-[var(--accent)] mt-0.5"
        />
      </div>
    </div>
  );
}
