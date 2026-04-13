"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ViewToggle } from "./ViewToggle";
import type { TemplateTag } from "@/types/templateTags";

export type SortMode = "newest" | "name-asc" | "name-desc" | "nodes";

interface TemplateFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  taskTags: TemplateTag[];
  providerTags: TemplateTag[];
  selectedTaskSlugs: Set<string>;
  selectedProviderSlugs: Set<string>;
  onToggleTask: (slug: string) => void;
  onToggleProvider: (slug: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  viewMode: "grid" | "list";
  onViewChange: (mode: "grid" | "list") => void;
}

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "name-asc", label: "Name A-Z" },
  { id: "name-desc", label: "Name Z-A" },
  { id: "nodes", label: "Most Nodes" },
];

/**
 * FilterDropdown: Shared dropdown component for multi-select filters
 */
interface FilterDropdownProps {
  label: string;
  tags: TemplateTag[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
}

function FilterDropdown({
  label,
  tags,
  selectedSlugs,
  onToggle,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredTags = tags.filter((tag) =>
    tag.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedCount = selectedSlugs.size;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors text-neutral-200 whitespace-nowrap"
      >
        {label}
        {selectedCount > 0 && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            {selectedCount}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg min-w-[200px]"
        >
          {/* Search input */}
          <div className="p-2 border-b border-neutral-700">
            <Input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full text-xs"
            />
          </div>

          {/* Checkbox list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => {
                const isSelected = selectedSlugs.has(tag.slug);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-700 cursor-pointer transition-colors text-sm text-neutral-200"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(tag.slug)}
                      className="w-3.5 h-3.5 rounded border-neutral-600 accent-[var(--accent)]"
                    />
                    <span className="flex-1">{tag.label}</span>
                    {tag.usageCount !== undefined && (
                      <span className="text-xs text-neutral-500">
                        {tag.usageCount}
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-neutral-500 text-center">
                No tags found
              </div>
            )}
          </div>

          {/* Clear all link */}
          {selectedCount > 0 && (
            <div className="border-t border-neutral-700 p-2">
              <button
                onClick={() => selectedSlugs.forEach((slug) => onToggle(slug))}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SortDropdown: Single-select dropdown for sort options
 */
interface SortDropdownProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

function SortDropdown({ sortMode, onSortChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentLabel =
    SORT_OPTIONS.find((opt) => opt.id === sortMode)?.label || "Sort";

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors text-neutral-200 whitespace-nowrap"
      >
        {currentLabel}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg min-w-[150px]"
        >
          {SORT_OPTIONS.map((option) => {
            const isSelected = sortMode === option.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onSortChange(option.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors text-neutral-200 flex items-center gap-2"
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
                {!isSelected && <div className="w-2 h-2 rounded-full" />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * TemplateFilterBar: Top bar with search, filters, sort, and view toggle
 */
export function TemplateFilterBar({
  searchQuery,
  onSearchChange,
  taskTags,
  providerTags,
  selectedTaskSlugs,
  selectedProviderSlugs,
  onToggleTask,
  onToggleProvider,
  sortMode,
  onSortChange,
  viewMode,
  onViewChange,
}: TemplateFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
      {/* Search input */}
      <div className="relative flex-1 sm:flex-none sm:min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-800 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Filter dropdowns and controls */}
      <div className="flex gap-2 sm:gap-3 items-stretch">
        <FilterDropdown
          label="Task"
          tags={taskTags}
          selectedSlugs={selectedTaskSlugs}
          onToggle={onToggleTask}
        />

        <FilterDropdown
          label="Model"
          tags={providerTags}
          selectedSlugs={selectedProviderSlugs}
          onToggle={onToggleProvider}
        />

        <SortDropdown sortMode={sortMode} onSortChange={onSortChange} />

        <ViewToggle mode={viewMode} onChange={onViewChange} />
      </div>
    </div>
  );
}
