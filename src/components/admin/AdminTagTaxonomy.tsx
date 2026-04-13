"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Layers,
  Target,
  Cpu,
  Palette,
  RefreshCw,
} from "lucide-react";
import type { TemplateTag, TagGroup } from "@/types/templateTags";
import { TAG_GROUP_LABELS } from "@/types/templateTags";
import { AdminNotification } from "./AdminNotification";

const GROUP_ICONS: Record<TagGroup, typeof Layers> = {
  generation: Layers,
  task: Target,
  provider: Cpu,
  style: Palette,
};

export function AdminTagTaxonomy() {
  const [tags, setTags] = useState<TemplateTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TagGroup>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [addingToGroup, setAddingToGroup] = useState<TagGroup | null>(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    type: "error" | "success" | "warning" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/template-tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      const data = await res.json();
      setTags(data.tags || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch tags";
      setError(msg);
      setNotification({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (group: TagGroup) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(group)) {
      newCollapsed.delete(group);
    } else {
      newCollapsed.add(group);
    }
    setCollapsedGroups(newCollapsed);
  };

  const startEdit = (tag: TemplateTag) => {
    setEditingId(tag.id);
    setEditLabel(tag.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) {
      setNotification({ type: "error", message: "Label cannot be empty" });
      return;
    }

    try {
      setSavingId(id);
      const res = await fetch(`/api/admin/template-tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tag");
      }

      setTags(
        tags.map((t) => (t.id === id ? { ...t, label: editLabel.trim() } : t))
      );
      setEditingId(null);
      setEditLabel("");
      setNotification({ type: "success", message: "Tag updated" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update tag";
      setNotification({ type: "error", message: msg });
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (id: number, currentActive: boolean) => {
    try {
      setSavingId(id);
      const res = await fetch(`/api/admin/template-tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tag");
      }

      setTags(
        tags.map((t) =>
          t.id === id ? { ...t, isActive: !currentActive } : t
        )
      );
      setNotification({
        type: "success",
        message: !currentActive ? "Tag activated" : "Tag deactivated",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update tag";
      setNotification({ type: "error", message: msg });
    } finally {
      setSavingId(null);
    }
  };

  const deleteTag = async (id: number) => {
    if (!window.confirm("Delete this tag? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/admin/template-tags/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete tag");
      }

      setTags(tags.filter((t) => t.id !== id));
      setNotification({ type: "success", message: "Tag deleted" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete tag";
      setNotification({ type: "error", message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const addTag = async (group: TagGroup) => {
    if (!newTagLabel.trim()) {
      setNotification({ type: "error", message: "Label cannot be empty" });
      return;
    }

    try {
      setSavingId(-1); // Use -1 as a pseudo-ID for add loading state
      const res = await fetch("/api/admin/template-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newTagLabel.trim(),
          groupKey: group,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create tag");
      }

      const data = await res.json();
      setTags([...tags, data.tag]);
      setAddingToGroup(null);
      setNewTagLabel("");
      setNotification({ type: "success", message: "Tag created" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create tag";
      setNotification({ type: "error", message: msg });
    } finally {
      setSavingId(null);
    }
  };

  const groups: TagGroup[] = ["generation", "task", "provider", "style"];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)] mb-3" />
        <p className="text-[var(--text-muted)] text-sm">Loading tags...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AdminNotification
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
        <button
          onClick={fetchTags}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notification && (
        <AdminNotification
          type={notification.type}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      {groups.map((group) => {
        const groupTags = tags.filter((t) => t.groupKey === group);
        const inactiveCount = groupTags.filter((t) => !t.isActive).length;
        const isCollapsed = collapsedGroups.has(group);
        const IconComponent = GROUP_ICONS[group];

        return (
          <div
            key={group}
            className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface-2)]"
          >
            {/* Group header */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
              onClick={() => toggleGroup(group)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  className="p-0.5 hover:bg-[var(--surface-3)] rounded transition-colors"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </button>

                <IconComponent className="w-4 h-4 text-[var(--accent)]" />

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">
                    {TAG_GROUP_LABELS[group]}
                  </h3>
                </div>

                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {groupTags.length} tag{groupTags.length !== 1 ? "s" : ""}
                  {inactiveCount > 0 && ` (${inactiveCount} inactive)`}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingToGroup(group);
                  setNewTagLabel("");
                }}
                className="ml-3 p-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                title="Add tag"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Group content */}
            {!isCollapsed && (
              <div className="border-t border-[var(--border)]">
                {groupTags.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-[var(--text-muted)]">
                    No tags in this group.{" "}
                    <button
                      onClick={() => {
                        setAddingToGroup(group);
                        setNewTagLabel("");
                      }}
                      className="text-[var(--accent)] hover:underline font-medium"
                    >
                      Add first tag
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {groupTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="px-4 py-3 hover:bg-[var(--surface-3)] transition-colors flex items-center gap-3"
                      >
                        {editingId === tag.id ? (
                          <>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="w-full px-2 py-1 rounded bg-[var(--surface-1)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="Tag label"
                                autoFocus
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(tag.id)}
                                disabled={savingId === tag.id}
                                className="px-3 py-1 rounded text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => startEdit(tag)}
                            >
                              <p className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                                {tag.label}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {tag.slug}
                              </p>
                            </div>

                            <button
                              onClick={() => toggleActive(tag.id, tag.isActive)}
                              disabled={savingId === tag.id}
                              className="p-1.5 rounded transition-colors disabled:opacity-50 hover:bg-[var(--surface-3)]"
                              title={tag.isActive ? "Deactivate" : "Activate"}
                            >
                              {tag.isActive ? (
                                <ToggleRight className="w-4 h-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-[var(--text-muted)]" />
                              )}
                            </button>

                            <button
                              onClick={() => deleteTag(tag.id)}
                              disabled={deletingId === tag.id}
                              className="p-1.5 rounded transition-colors disabled:opacity-50 hover:bg-red-500/20"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add tag form */}
                {addingToGroup === group && (
                  <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-1)]">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTagLabel}
                        onChange={(e) => setNewTagLabel(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            addTag(group);
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder="New tag label..."
                        autoFocus
                      />

                      <button
                        onClick={() => addTag(group)}
                        disabled={savingId === -1}
                        className="px-3 py-2 rounded text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        Add
                      </button>

                      <button
                        onClick={() => {
                          setAddingToGroup(null);
                          setNewTagLabel("");
                        }}
                        className="px-3 py-2 rounded text-sm font-medium bg-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
