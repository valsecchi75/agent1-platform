"use client";

import { Plus, X } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTabStore } from "@/store/tabStore";
import { useWorkflowStore } from "@/store/workflowStore";

export function WorkflowTabs() {
  const { tabs, activeTabId, addTab, closeTab, switchTab, updateTabLabel, syncActiveTabState } =
    useTabStore(
      useShallow((state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        addTab: state.addTab,
        closeTab: state.closeTab,
        switchTab: state.switchTab,
        updateTabLabel: state.updateTabLabel,
        syncActiveTabState: state.syncActiveTabState,
      }))
    );

  // Sync tab label when workflowName changes
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const hasUnsavedChanges = useWorkflowStore((state) => state.hasUnsavedChanges);

  useEffect(() => {
    syncActiveTabState();
  }, [workflowName, hasUnsavedChanges, syncActiveTabState]);

  // Editing state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = useCallback((tabId: string, currentLabel: string) => {
    setEditingTabId(tabId);
    setEditValue(currentLabel);
    // Focus after render
    setTimeout(() => editInputRef.current?.select(), 0);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId && editValue.trim()) {
      updateTabLabel(editingTabId, editValue.trim());
      // Also update workflowName if this is the active tab
      if (editingTabId === activeTabId) {
        useWorkflowStore.getState().setWorkflowName(editValue.trim());
      }
    }
    setEditingTabId(null);
  }, [editingTabId, editValue, updateTabLabel, activeTabId]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        setEditingTabId(null);
      }
    },
    [commitEdit]
  );

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      // Middle-click closes tab
      if (e.button === 1) {
        e.preventDefault();
        closeTab(tabId);
      }
    },
    [closeTab]
  );

  return (
    <div
      className="flex items-center h-8 shrink-0 overflow-x-auto select-none"
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Tab list */}
      <div className="flex items-stretch h-full min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const showDot = isActive ? hasUnsavedChanges : tab.hasUnsavedChanges;

          return (
            <button
              key={tab.id}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              onClick={() => switchTab(tab.id)}
              onDoubleClick={() => handleDoubleClick(tab.id, tab.label)}
              className="group relative flex items-center gap-1.5 px-3 h-full text-xs transition-colors whitespace-nowrap max-w-[200px]"
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                background: isActive ? "var(--surface-2)" : "transparent",
                borderRight: "1px solid var(--border-subtle)",
              }}
              title={tab.label}
            >
              {/* Unsaved dot */}
              {showDot && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--accent)" }}
                />
              )}

              {/* Label or edit input */}
              {editingTabId === tab.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  className="bg-transparent border-none outline-none text-xs w-full min-w-[60px]"
                  style={{ color: "var(--text-primary)" }}
                  autoFocus
                />
              ) : (
                <span className="truncate">{tab.label}</span>
              )}

              {/* Close button — visible on hover or when active, hidden if only 1 tab */}
              {tabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 shrink-0 rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                  style={{
                    opacity: isActive ? 0.6 : undefined,
                    color: "var(--text-muted)",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = "var(--text-primary)";
                    (e.target as HTMLElement).style.background = "var(--surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = "var(--text-muted)";
                    (e.target as HTMLElement).style.background = "transparent";
                  }}
                >
                  <X className="w-3 h-3" />
                </span>
              )}

              {/* Active tab bottom indicator */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Add tab button */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => addTab()}
              className="flex items-center justify-center w-7 h-7 shrink-0 ml-0.5 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = "var(--text-primary)";
                (e.target as HTMLElement).style.background = "var(--surface-3)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = "var(--text-muted)";
                (e.target as HTMLElement).style.background = "transparent";
              }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New workflow tab (Ctrl+T)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
