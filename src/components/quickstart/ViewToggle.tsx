"use client";

import { LayoutGrid, List } from "lucide-react";

interface ViewToggleProps {
  mode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border border-neutral-700 rounded-md overflow-hidden">
      <button
        onClick={() => onChange("grid")}
        className={`p-1.5 transition-colors ${
          mode === "grid"
            ? "bg-[var(--accent)] text-white"
            : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
        }`}
        title="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange("list")}
        className={`p-1.5 transition-colors ${
          mode === "list"
            ? "bg-[var(--accent)] text-white"
            : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
        }`}
        title="List view"
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}
