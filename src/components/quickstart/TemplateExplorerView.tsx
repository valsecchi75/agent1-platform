"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { QuickstartBackButton } from "./QuickstartBackButton";
import { TemplateCard } from "./TemplateCard";
import { TemplateGridCard } from "./TemplateGridCard";
import { TemplateFilterBar, SortMode } from "./TemplateFilterBar";
import { ViewToggle } from "./ViewToggle";
import { WorkflowFile } from "@/store/workflowStore";
import type {
  TemplatePackMeta,
  TemplateCategory,
  RegistryEntry,
  TemplateRegistry,
} from "@/types/templates";
import type { TemplateTag } from "@/types/templateTags";
import { Globe, RefreshCw } from "lucide-react";

interface TemplateExplorerViewProps {
  onBack: () => void;
  onWorkflowSelected: (workflow: WorkflowFile) => void;
}

type CategoryFilter = "all" | TemplateCategory;
type SourceFilter = "all" | "local" | "remote";

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "simple", label: "Simple" },
  { id: "advanced", label: "Advanced" },
  { id: "production", label: "Production" },
  { id: "experimental", label: "Experimental" },
];

// ─── Fixed registry URL ──────────────────────────────────────────
const REGISTRY_URL =
  "https://raw.githubusercontent.com/valsecchi75/agent1/main/registry.json";
const REGISTRY_BASE_URL =
  "https://raw.githubusercontent.com/valsecchi75/agent1/main";

// Key used in localStorage to track when remote templates were first seen
const REMOTE_SEEN_KEY = "agent1_remote_seen_slugs";

/**
 * Convert a RegistryEntry to TemplatePackMeta for unified rendering
 */
function registryEntryToMeta(
  entry: RegistryEntry,
  baseUrl: string = REGISTRY_BASE_URL
): TemplatePackMeta {
  return {
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    author: entry.author,
    createdAt: "",
    updatedAt: "",
    source: "remote",
    sourceUrl: baseUrl,
    registryVersion: entry.version,
    category: entry.category,
    tags: entry.tags || [],
    techTags: entry.techTags || [],
    taskTags: [],
    nodeCount: entry.nodeCount,
    previewFrames: entry.previewFrames || [],
  };
}

/**
 * Get the set of remote slugs that the user has already seen
 */
function getSeenRemoteSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(REMOTE_SEEN_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

/**
 * Mark remote slugs as seen
 */
function markRemoteSlugsAsSeen(slugs: string[]) {
  try {
    const existing = getSeenRemoteSlugs();
    slugs.forEach((s) => existing.add(s));
    localStorage.setItem(REMOTE_SEEN_KEY, JSON.stringify([...existing]));
  } catch {
    /* ignore */
  }
}

export function TemplateExplorerView({
  onBack,
  onWorkflowSelected,
}: TemplateExplorerViewProps) {
  // Local templates
  const [templates, setTemplates] = useState<TemplatePackMeta[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [loadingTemplateSlug, setLoadingTemplateSlug] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Remote registry
  const [remoteTemplates, setRemoteTemplates] = useState<TemplatePackMeta[]>(
    []
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [registrySource, setRegistrySource] = useState<
    "remote" | "local-fallback"
  >("remote");

  // Track which remote slugs are "new" (never seen before)
  const [newRemoteSlugs, setNewRemoteSlugs] = useState<Set<string>>(
    new Set()
  );

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // View mode (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const saved = localStorage.getItem("agent1-template-view-mode");
      return saved === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });

  const handleViewChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("agent1-template-view-mode", mode);
    } catch {
      /* ignore */
    }
  };

  // Taxonomy-based filters
  const [taxonomyTags, setTaxonomyTags] = useState<TemplateTag[]>([]);
  const [generationFilter, setGenerationFilter] = useState<string | null>(null);
  const [selectedTaskSlugs, setSelectedTaskSlugs] = useState<Set<string>>(
    new Set()
  );
  const [selectedProviderSlugs, setSelectedProviderSlugs] = useState<
    Set<string>
  >(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch taxonomy tags on mount
  useEffect(() => {
    async function fetchTaxonomyTags() {
      try {
        const response = await fetch("/api/template-tags");
        const result = await response.json();
        if (result.success && Array.isArray(result.tags)) {
          setTaxonomyTags(result.tags);
        }
      } catch (err) {
        console.error("Error fetching taxonomy tags:", err);
      }
    }
    fetchTaxonomyTags();
  }, []);

  // Combine local + remote (remote duplicates kept for "Online" view)
  const localSlugs = useMemo(
    () => new Set(templates.map((t) => t.slug)),
    [templates]
  );
  const allTemplates = useMemo(() => {
    // Force source="local" on templates from the API, because some may have
    // source="remote" in their JSON (installed from registry). We need to
    // distinguish them from actual remote registry entries.
    const localNormalized = templates.map((t) => ({
      ...t,
      source: "local" as const,
    }));
    // Remote entries always get source="remote"
    return [...localNormalized, ...remoteTemplates];
  }, [templates, remoteTemplates]);

  // Filter
  const filteredTemplates = useMemo(() => {
    const filtered = allTemplates.filter((template) => {
      if (sourceFilter !== "all" && template.source !== sourceFilter)
        return false;
      // When showing "all", skip remote duplicates that are already installed locally
      if (
        sourceFilter === "all" &&
        template.source === "remote" &&
        localSlugs.has(template.slug)
      )
        return false;
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        if (
          !template.name.toLowerCase().includes(s) &&
          !template.description.toLowerCase().includes(s) &&
          !template.author.toLowerCase().includes(s)
        )
          return false;
      }
      if (categoryFilter !== "all" && template.category !== categoryFilter)
        return false;

      // Generation filter from sidebar
      if (generationFilter) {
        const genTag = taxonomyTags.find((t) => t.slug === generationFilter);
        if (genTag) {
          const allTags = [
            ...template.tags,
            ...template.techTags,
            ...(template.taskTags || []),
          ];
          if (!allTags.some((t) => t === genTag.label)) return false;
        }
      }

      // Task dropdown filter
      if (selectedTaskSlugs.size > 0) {
        const taskLabels = getTagLabelsBySlugs(selectedTaskSlugs, taxonomyTags);
        const allTags = [
          ...template.tags,
          ...template.techTags,
          ...(template.taskTags || []),
        ];
        if (!allTags.some((t) => taskLabels.has(t))) return false;
      }

      // Provider dropdown filter
      if (selectedProviderSlugs.size > 0) {
        const providerLabels = getTagLabelsBySlugs(
          selectedProviderSlugs,
          taxonomyTags
        );
        const allTags = [...template.tags, ...template.techTags];
        if (!allTags.some((t) => providerLabels.has(t))) return false;
      }

      return true;
    });

    // Sort: based on sortMode
    switch (sortMode) {
      case "newest":
        filtered.sort((a, b) => {
          // New remote first, then by date or name
          const aNew =
            a.source === "remote" && newRemoteSlugs.has(a.slug) ? 1 : 0;
          const bNew =
            b.source === "remote" && newRemoteSlugs.has(b.slug) ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew;
          return (
            (b.updatedAt || b.createdAt || "").localeCompare(
              a.updatedAt || a.createdAt || ""
            ) || a.name.localeCompare(b.name)
          );
        });
        break;
      case "name-asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "nodes":
        filtered.sort((a, b) => b.nodeCount - a.nodeCount);
        break;
    }

    return filtered;
  }, [
    allTemplates,
    debouncedSearch,
    categoryFilter,
    sourceFilter,
    generationFilter,
    selectedTaskSlugs,
    selectedProviderSlugs,
    newRemoteSlugs,
    localSlugs,
    sortMode,
    taxonomyTags,
  ]);

  // Split taxonomy tags by groupKey
  const taskTags = useMemo(
    () => taxonomyTags.filter((t) => t.groupKey === "task"),
    [taxonomyTags]
  );
  const providerTags = useMemo(
    () => taxonomyTags.filter((t) => t.groupKey === "provider"),
    [taxonomyTags]
  );
  const generationTags = useMemo(
    () => taxonomyTags.filter((t) => t.groupKey === "generation"),
    [taxonomyTags]
  );

  // Helper to toggle slug sets
  function toggleSlugSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    slug: string
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  // Helper to get tag labels from slugs
  function getTagLabelsBySlugs(
    slugs: Set<string>,
    taxonomy: TemplateTag[]
  ): Set<string> {
    const labels = new Set<string>();
    for (const slug of slugs) {
      const tag = taxonomy.find((t) => t.slug === slug);
      if (tag) labels.add(tag.label);
    }
    return labels;
  }

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setCategoryFilter("all");
    setSourceFilter("all");
    setGenerationFilter(null);
    setSelectedTaskSlugs(new Set());
    setSelectedProviderSlugs(new Set());
    setSortMode("newest");
  }, []);

  const hasActiveFilters =
    searchQuery ||
    categoryFilter !== "all" ||
    sourceFilter !== "all" ||
    generationFilter !== null ||
    selectedTaskSlugs.size > 0 ||
    selectedProviderSlugs.size > 0;
  const hasNoResults = filteredTemplates.length === 0 && !isLoadingList;

  // ─── Fetch local templates ─────────────────────────────────────
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch("/api/templates");
        const result = await response.json();
        if (result.success && Array.isArray(result.templates)) {
          setTemplates(result.templates);
        } else {
          setError(result.error || "Failed to load templates");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load templates"
        );
      } finally {
        setIsLoadingList(false);
      }
    }
    fetchTemplates();
  }, []);

  // ─── Fetch remote registry (auto on mount) ────────────────────
  const fetchRemoteRegistry = useCallback(async () => {
    setIsLoadingRemote(true);
    setRemoteError(null);

    try {
      const response = await fetch(
        `/api/templates/registry?url=${encodeURIComponent(REGISTRY_URL)}`
      );
      const result = await response.json();

      if (!result.success || !result.registry) {
        throw new Error(result.error || "Failed to fetch remote registry");
      }

      const registry = result.registry as TemplateRegistry;

      // When served from local fallback, use our local preview endpoint
      const effectiveBaseUrl =
        result.source === "local-fallback"
          ? "/api/registry-assets"
          : REGISTRY_BASE_URL;

      const metas = registry.templates.map((entry) =>
        registryEntryToMeta(entry, effectiveBaseUrl)
      );

      setRegistrySource(result.source === "local-fallback" ? "local-fallback" : "remote");
      setRemoteTemplates(metas);

      // Determine which are new (never seen before)
      const previouslySeen = getSeenRemoteSlugs();
      const currentSlugs = metas.map((m) => m.slug);
      const brandNew = currentSlugs.filter((s) => !previouslySeen.has(s));

      if (brandNew.length > 0) {
        setNewRemoteSlugs(new Set(brandNew));
        // Mark them as seen after 30 seconds so the "New" badge fades on next visit
        setTimeout(() => {
          markRemoteSlugsAsSeen(currentSlugs);
        }, 30000);
      } else {
        // All already seen, but mark again to stay in sync
        markRemoteSlugsAsSeen(currentSlugs);
      }
    } catch (err) {
      console.error("Error fetching remote registry:", err);
      setRemoteError(
        err instanceof Error ? err.message : "Failed to fetch registry"
      );
      setRemoteTemplates([]);
    } finally {
      setIsLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    fetchRemoteRegistry();
  }, [fetchRemoteRegistry]);

  // ─── Use local template ───────────────────────────────────────
  const handleUseTemplate = useCallback(
    async (templateSlug: string) => {
      setLoadingTemplateSlug(templateSlug);
      setError(null);
      try {
        const response = await fetch(`/api/templates/${templateSlug}`);
        const result = await response.json();
        if (!result.success || !result.template)
          throw new Error(result.error || "Failed to load template");

        const td = result.template;
        const workflow: WorkflowFile = {
          version: 1,
          id: templateSlug,
          name: td.name,
          nodes: td.nodes || [],
          edges: td.edges || [],
          groups: td.groups || {},
          edgeStyle: td.edgeStyle || "default",
        };
        onWorkflowSelected(workflow);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load template"
        );
      } finally {
        setLoadingTemplateSlug(null);
      }
    },
    [onWorkflowSelected]
  );

  // ─── Install remote template ──────────────────────────────────
  const handleInstallTemplate = useCallback(
    async (templateSlug: string) => {
      setInstallingSlug(templateSlug);
      setError(null);
      try {
        const remoteEntry = remoteTemplates.find(
          (t) => t.slug === templateSlug
        );
        if (!remoteEntry)
          throw new Error("Template not found in remote registry");

        const response = await fetch("/api/templates/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registryBaseUrl: REGISTRY_BASE_URL + "/",
            slug: templateSlug,
            templatePath: `templates/${templateSlug}/template.json`,
            previewFrames: remoteEntry.previewFrames,
          }),
        });

        const result = await response.json();
        if (!result.success)
          throw new Error(result.error || "Failed to install template");

        // Refresh local templates
        const refreshResponse = await fetch("/api/templates");
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success && Array.isArray(refreshResult.templates)) {
          setTemplates(refreshResult.templates);
        }

        // Remove from new set
        setNewRemoteSlugs((prev) => {
          const next = new Set(prev);
          next.delete(templateSlug);
          return next;
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to install template"
        );
      } finally {
        setInstallingSlug(null);
      }
    },
    [remoteTemplates]
  );

  // ─── Delete local template ────────────────────────────────────
  const handleDeleteTemplate = useCallback(
    async (templateSlug: string) => {
      if (
        !window.confirm(
          "Are you sure you want to delete this template? This cannot be undone."
        )
      )
        return;
      setError(null);
      try {
        const response = await fetch(`/api/templates/${templateSlug}`, {
          method: "DELETE",
        });
        const result = await response.json();
        if (!result.success)
          throw new Error(result.error || "Failed to delete template");
        setTemplates((prev) => prev.filter((t) => t.slug !== templateSlug));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete template"
        );
      }
    },
    []
  );

  const handleEditTemplate = useCallback(
    async (templateSlug: string) => {
      await handleUseTemplate(templateSlug);
    },
    [handleUseTemplate]
  );

  const isLoading = loadingTemplateSlug !== null;

  // Count by source for sidebar badges
  const localCount = filteredTemplates.filter(
    (t) => t.source === "local"
  ).length;
  const remoteCount = filteredTemplates.filter(
    (t) => t.source === "remote"
  ).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-700 flex items-center gap-4">
        <QuickstartBackButton onClick={onBack} disabled={isLoading} />
        <h2 className="text-lg font-semibold text-neutral-100">
          Template Explorer
        </h2>
        <div className="flex-1" />

        {/* Remote registry status + refresh */}
        <div className="flex items-center gap-2">
          {isLoadingRemote ? (
            <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Syncing...
            </div>
          ) : remoteTemplates.length > 0 ? (
            <div className="flex items-center gap-1.5 text-blue-400 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <span>{remoteTemplates.length} online</span>
            </div>
          ) : remoteError ? (
            <div className="flex items-center gap-1.5 text-red-400 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <span>Offline</span>
            </div>
          ) : null}
          <button
            onClick={fetchRemoteRegistry}
            disabled={isLoadingRemote}
            className="p-1.5 text-neutral-500 hover:text-neutral-300 rounded-md hover:bg-neutral-700/50 transition-colors disabled:opacity-50"
            title="Refresh remote templates"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content - Sidebar + Main Grid */}
      <div className="flex-1 flex min-h-0 overflow-clip">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 bg-neutral-900/80 border-r border-neutral-700 p-4 space-y-5 overflow-y-auto">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-neutral-700/50 border border-neutral-600 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
          </div>

          {/* Browse */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
              Browse
            </h3>
            <button
              onClick={() => setGenerationFilter(null)}
              className={`
                w-full px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors flex items-center justify-between
                ${
                  generationFilter === null
                    ? "bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]"
                    : "bg-neutral-700/30 border border-transparent text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300"
                }
              `}
            >
              <span>All Templates</span>
              <span className="text-[10px] opacity-60">{filteredTemplates.length}</span>
            </button>
          </div>

          {/* Generation Type */}
          {generationTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                Generation Type
              </h3>
              <div className="flex flex-col gap-1">
                {generationTags.map((tag) => {
                  const count = filteredTemplates.filter((t) => {
                    const allTags = [
                      ...t.tags,
                      ...t.techTags,
                      ...(t.taskTags || []),
                    ];
                    return allTags.includes(tag.label);
                  }).length;
                  return (
                    <button
                      key={tag.slug}
                      onClick={() =>
                        setGenerationFilter(
                          generationFilter === tag.slug ? null : tag.slug
                        )
                      }
                      className={`
                        w-full px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors flex items-center justify-between
                        ${
                          generationFilter === tag.slug
                            ? "bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]"
                            : "bg-neutral-700/30 border border-transparent text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300"
                        }
                      `}
                    >
                      <span>{tag.label}</span>
                      <span className="text-[10px] opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source Filter */}
          {remoteTemplates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                Source
              </h3>
              <div className="flex flex-col gap-1">
                {(
                  [
                    { id: "all" as SourceFilter, label: "All" },
                    { id: "local" as SourceFilter, label: "Local" },
                    { id: "remote" as SourceFilter, label: "Online" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSourceFilter(option.id)}
                    className={`
                      w-full px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors flex items-center justify-between
                      ${
                        sourceFilter === option.id
                          ? "bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]"
                          : "bg-neutral-700/30 border border-transparent text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300"
                      }
                    `}
                  >
                    <span>{option.label}</span>
                    <span className="text-[10px] opacity-60">
                      {option.id === "all"
                        ? templates.length +
                          remoteTemplates.filter(
                            (rt) => !localSlugs.has(rt.slug)
                          ).length
                        : option.id === "local"
                          ? templates.length
                          : remoteTemplates.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Filters */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
              Category
            </h3>
            <div className="flex flex-col gap-1">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setCategoryFilter(option.id)}
                  className={`
                    w-full px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors
                    ${
                      categoryFilter === option.id
                        ? "bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]"
                        : "bg-neutral-700/30 border border-transparent text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-300 bg-neutral-700/30 hover:bg-neutral-700/50 rounded-md transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* Empty State - No templates at all */}
          {allTemplates.length === 0 &&
            !isLoadingList &&
            !isLoadingRemote && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg
                  className="w-12 h-12 text-neutral-600 mb-4"
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
                <h3 className="text-sm font-medium text-neutral-300 mb-1">
                  No templates found
                </h3>
                <p className="text-xs text-neutral-500 mb-4">
                  Create a template or wait for the online registry to load.
                </p>
              </div>
            )}

          {/* Empty State - No results from filters */}
          {hasNoResults && hasActiveFilters && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="w-12 h-12 text-neutral-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <h3 className="text-sm font-medium text-neutral-300 mb-1">
                No templates match your filters
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                Try adjusting your search or filters
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Filter Bar + Templates Grid */}
          {!isLoadingList && filteredTemplates.length > 0 && (
            <div className="space-y-4">
              <TemplateFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                taskTags={taskTags}
                providerTags={providerTags}
                selectedTaskSlugs={selectedTaskSlugs}
                selectedProviderSlugs={selectedProviderSlugs}
                onToggleTask={(slug) => toggleSlugSet(setSelectedTaskSlugs, slug)}
                onToggleProvider={(slug) =>
                  toggleSlugSet(setSelectedProviderSlugs, slug)
                }
                sortMode={sortMode}
                onSortChange={setSortMode}
                viewMode={viewMode}
                onViewChange={handleViewChange}
              />

              <div>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                  Templates ({filteredTemplates.length})
                  {localCount > 0 && remoteCount > 0 && (
                    <span className="font-normal ml-2 text-neutral-500">
                      {localCount} local, {remoteCount} online
                    </span>
                  )}
                </h3>

                {viewMode === "grid" ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {filteredTemplates.map((template) => (
                      <TemplateGridCard
                        key={`${template.source}-${template.slug}`}
                        template={template}
                        isLoading={
                          loadingTemplateSlug === template.slug ||
                          installingSlug === template.slug
                        }
                        isNew={
                          template.source === "remote" &&
                          newRemoteSlugs.has(template.slug)
                        }
                        isInstalled={
                          template.source === "remote" &&
                          localSlugs.has(template.slug)
                        }
                        onUseWorkflow={
                          template.source === "local"
                            ? () => handleUseTemplate(template.slug)
                            : template.source === "remote" &&
                              localSlugs.has(template.slug)
                            ? () => handleUseTemplate(template.slug)
                            : () => handleInstallTemplate(template.slug)
                        }
                        onDelete={
                          template.source === "local"
                            ? () => handleDeleteTemplate(template.slug)
                            : undefined
                        }
                        onEdit={
                          template.source === "local"
                            ? () => handleEditTemplate(template.slug)
                            : undefined
                        }
                        disabled={
                          (isLoading || installingSlug !== null) &&
                          loadingTemplateSlug !== template.slug &&
                          installingSlug !== template.slug
                        }
                        remoteBaseUrl={
                          template.source === "remote"
                            ? template.sourceUrl || REGISTRY_BASE_URL
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredTemplates.map((template) => (
                      <TemplateCard
                        key={`${template.source}-${template.slug}`}
                        template={template}
                        isLoading={
                          loadingTemplateSlug === template.slug ||
                          installingSlug === template.slug
                        }
                        isNew={
                          template.source === "remote" &&
                          newRemoteSlugs.has(template.slug)
                        }
                        isInstalled={
                          template.source === "remote" &&
                          localSlugs.has(template.slug)
                        }
                        onUseWorkflow={
                          template.source === "local"
                            ? () => handleUseTemplate(template.slug)
                            : template.source === "remote" &&
                              localSlugs.has(template.slug)
                            ? () => handleUseTemplate(template.slug)
                            : () => handleInstallTemplate(template.slug)
                        }
                        onDelete={
                          template.source === "local"
                            ? () => handleDeleteTemplate(template.slug)
                            : undefined
                        }
                        onEdit={
                          template.source === "local"
                            ? () => handleEditTemplate(template.slug)
                            : undefined
                        }
                        disabled={
                          (isLoading || installingSlug !== null) &&
                          loadingTemplateSlug !== template.slug &&
                          installingSlug !== template.slug
                        }
                        remoteBaseUrl={
                          template.source === "remote"
                            ? template.sourceUrl || REGISTRY_BASE_URL
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {(isLoadingList || isLoadingRemote) && (
            <div className="flex items-center justify-center py-12 gap-2">
              <svg
                className="w-5 h-5 text-neutral-500 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {isLoadingRemote && !isLoadingList && (
                <span className="text-xs text-neutral-500">
                  Loading online templates...
                </span>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <svg
                className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-400/70 hover:text-red-400 mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
