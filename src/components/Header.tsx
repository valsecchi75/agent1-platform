"use client";

import {
  BarChart3,
  ChevronDown,
  CircleUser,
  ExternalLink,
  FolderOpen,
  Heart,
  HelpCircle,
  Images,
  Info,
  Keyboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Plus,
  Puzzle,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatVersion } from "@/lib/appVersion";
import { useTabStore } from "@/store/tabStore";
import { useWorkflowStore, WorkflowFile } from "@/store/workflowStore";

import { NodePackManager } from "@/components/node-packs";
import { AdminPanel } from "./admin/AdminPanel";
import { CostIndicator } from "./CostIndicator";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ProjectSetupModal } from "./ProjectSetupModal";
import { SaveAsTemplateModal } from "./SaveAsTemplateModal";
import { BrandLogo } from "./settings/BrandLogo";
import { CreditsModal } from "./settings/CreditsModal";
import { useOnboardingStore } from "@/store/onboardingStore";

function CommentsNavigationIcon() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const getNodesWithComments = useWorkflowStore((state) => state.getNodesWithComments);
  const viewedCommentNodeIds = useWorkflowStore((state) => state.viewedCommentNodeIds);
  const markCommentViewed = useWorkflowStore((state) => state.markCommentViewed);
  const setNavigationTarget = useWorkflowStore((state) => state.setNavigationTarget);

  const nodesWithComments = useMemo(() => getNodesWithComments(), [getNodesWithComments, nodes]);
  const unviewedCount = useMemo(() => {
    return nodesWithComments.filter((node) => !viewedCommentNodeIds.has(node.id)).length;
  }, [nodesWithComments, viewedCommentNodeIds]);
  const totalCount = nodesWithComments.length;

  const handleClick = useCallback(() => {
    if (totalCount === 0) return;
    const targetNode = nodesWithComments.find((node) => !viewedCommentNodeIds.has(node.id)) || nodesWithComments[0];
    if (targetNode) {
      markCommentViewed(targetNode.id);
      setNavigationTarget(targetNode.id);
    }
  }, [totalCount, nodesWithComments, viewedCommentNodeIds, markCommentViewed, setNavigationTarget]);

  if (totalCount === 0) return null;

  const displayCount = unviewedCount > 9 ? "9+" : unviewedCount.toString();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={handleClick} className="relative">
          <MessageSquare className="w-4 h-4 fill-current" />
          {unviewedCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold text-[var(--btn-primary-text)] bg-[var(--accent)] rounded-full px-0.5">
              {displayCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {unviewedCount} unviewed comment{unviewedCount !== 1 ? "s" : ""} ({totalCount} total)
      </TooltipContent>
    </Tooltip>
  );
}

export function Header() {
  const router = useRouter();
  const {
    workflowName,
    workflowId,
    saveDirectoryPath,
    hasUnsavedChanges,
    lastSavedAt,
    isSaving,
    setWorkflowMetadata,
    saveToFile,
    saveAsFile,
    loadWorkflow,
    previousWorkflowSnapshot,
    revertToSnapshot,
    shortcutsDialogOpen,
    setShortcutsDialogOpen,
    setShowQuickstart,
    nodes,
    edges,
    edgeStyle,
    groups,
  } = useWorkflowStore(useShallow((state) => ({
    workflowName: state.workflowName,
    workflowId: state.workflowId,
    saveDirectoryPath: state.saveDirectoryPath,
    hasUnsavedChanges: state.hasUnsavedChanges,
    lastSavedAt: state.lastSavedAt,
    isSaving: state.isSaving,
    setWorkflowMetadata: state.setWorkflowMetadata,
    saveToFile: state.saveToFile,
    saveAsFile: state.saveAsFile,
    loadWorkflow: state.loadWorkflow,
    previousWorkflowSnapshot: state.previousWorkflowSnapshot,
    revertToSnapshot: state.revertToSnapshot,
    shortcutsDialogOpen: state.shortcutsDialogOpen,
    setShortcutsDialogOpen: state.setShortcutsDialogOpen,
    setShowQuickstart: state.setShowQuickstart,
    nodes: state.nodes,
    edges: state.edges,
    edgeStyle: state.edgeStyle,
    groups: state.groups,
  })));

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<"new" | "settings">("new");
  const [showCredits, setShowCredits] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [nodePackManagerOpen, setNodePackManagerOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const nodePackBadge = useWorkflowStore((s) => s.nodePackBadgeActive);
  const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isProjectConfigured = !!workflowName;
  const canSave = !!(workflowId && workflowName && saveDirectoryPath);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const tabAddTab = useTabStore((state) => state.addTab);
  const tabSyncState = useTabStore((state) => state.syncActiveTabState);

  const handleNewProject = () => {
    // Create a new tab with a fresh canvas, then open the project modal
    tabAddTab();
    setProjectModalMode("new");
    setShowProjectModal(true);
  };

  const handleOpenSettings = () => {
    setProjectModalMode("settings");
    setShowProjectModal(true);
  };

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const workflow = JSON.parse(event.target?.result as string) as WorkflowFile;
        if (workflow.version && workflow.nodes && workflow.edges) {
          await loadWorkflow(workflow);
          tabSyncState();
        } else {
          alert("Invalid workflow file format");
        }
      } catch {
        alert("Failed to parse workflow file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleProjectSave = async (id: string, name: string, path: string) => {
    setWorkflowMetadata(id, name, path);
    setShowProjectModal(false);
    tabSyncState();
    setTimeout(() => {
      saveToFile().then(() => tabSyncState()).catch((error) => {
        console.error("Failed to save project:", error);
        alert("Failed to save project. Please try again.");
      });
    }, 50);
  };

  const handleOpenDirectory = async () => {
    if (!saveDirectoryPath) return;
    try {
      const response = await fetch("/api/open-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: saveDirectoryPath }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        console.error("Failed to open directory:", result.error);
        alert(`Failed to open project folder: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to open directory:", error);
      alert("Failed to open project folder. Please try again.");
    }
  };

  const handleRevertAIChanges = useCallback(() => {
    const confirmed = window.confirm("Are you sure? This will restore your previous workflow.");
    if (confirmed) {
      revertToSnapshot();
    }
  }, [revertToSnapshot]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user || null);
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showSaveMenu || showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSaveMenu, showUserMenu]);

  const settingsButtons = (
    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-neutral-700/50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleOpenSettings}>
            <Settings className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setNodePackManagerOpen(true);
              setNodePackBadge(false);
            }}
            className="relative"
          >
            <Puzzle className="w-4 h-4" />
            {nodePackBadge && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Node Pack Manager</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <ProjectSetupModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSave={handleProjectSave}
        mode={projectModalMode}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <header
        className="h-11 flex items-center justify-between px-4 shrink-0"
        style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)" }}
      >
        <div className="flex items-center gap-2">
          {/* Brand */}
          <button
            onClick={() => setShowQuickstart(true)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Open welcome screen"
          >
            <BrandLogo variant="brand" height="h-3.5" />
            <span className="mx-1.5" style={{ color: "var(--border)" }}>|</span>
            <BrandLogo variant="wordmark" height="h-3.5" />
            <span
              className="text-[8px] font-medium tracking-wider uppercase px-1 py-0.5 rounded ml-1.5"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {formatVersion()}
            </span>
          </button>

          {/* Quick actions */}
          <div className="flex items-center gap-1 ml-3 pl-3 border-l border-neutral-700/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleNewProject}>
                  <Plus className="w-3.5 h-3.5" />
                  New
                </Button>
              </TooltipTrigger>
              <TooltipContent>New project</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowQuickstart(true, "templates")}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Templates
                </Button>
              </TooltipTrigger>
              <TooltipContent>Browse templates</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowQuickstart(true, "vibe")}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Prompt
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate workflow with AI</TooltipContent>
            </Tooltip>
          </div>

          {/* Project info + file operations */}
          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-neutral-700/50">
            {isProjectConfigured ? (
              <>
                <span className="text-sm text-neutral-300">{workflowName}</span>
                <span className="text-neutral-600">|</span>
                <CostIndicator />

                <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-neutral-700/50">
                  {/* Save dropdown — Save, Save As, Save as Template */}
                  <div ref={saveMenuRef} className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => (canSave ? saveToFile() : handleOpenSettings())}
                          onContextMenu={(e) => { e.preventDefault(); setShowSaveMenu((prev) => !prev); }}
                          disabled={isSaving}
                          className="relative"
                        >
                          <Save className="w-4 h-4" />
                          {hasUnsavedChanges && !isSaving && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-neutral-900" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isSaving ? "Saving..." : canSave ? "Save (right-click for more)" : "Configure save location"}
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSaveMenu((prev) => !prev)}
                      className="w-4 h-8 px-0 -ml-1"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>

                    {showSaveMenu && (
                      <div
                        className="absolute top-full left-0 mt-1 w-48 rounded-lg shadow-lg py-1 z-50"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                      >
                        <button
                          onClick={() => {
                            setShowSaveMenu(false);
                            canSave ? saveToFile() : handleOpenSettings();
                          }}
                          disabled={isSaving}
                          className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveMenu(false);
                            const newName = prompt("Save as:", workflowName || "");
                            if (newName && newName.trim()) {
                              saveAsFile(newName.trim());
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          <Save className="w-4 h-4" />
                          Save As...
                        </button>
                        <div className="h-px my-1" style={{ background: "var(--border)" }} />
                        <button
                          onClick={() => {
                            setShowSaveMenu(false);
                            setShowSaveAsTemplateModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                        >
                          <LayoutGrid className="w-4 h-4" />
                          Save as Template...
                        </button>
                      </div>
                    )}
                  </div>
                  {saveDirectoryPath && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleOpenDirectory}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open Project Folder</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleOpenFile}>
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open project</TooltipContent>
                  </Tooltip>
                </div>

                {settingsButtons}
              </>
            ) : (
              <>
                <span className="text-sm text-neutral-500 italic">Untitled</span>

                <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-neutral-700/50">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleNewProject} className="relative">
                        <Save className="w-4 h-4" />
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-neutral-900" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save project</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleOpenFile}>
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open project</TooltipContent>
                  </Tooltip>
                </div>

                {settingsButtons}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs">
          {previousWorkflowSnapshot && (
            <Button variant="outline" size="sm" onClick={handleRevertAIChanges} className="mr-1">
              <RotateCcw className="w-3 h-3" />
              Revert AI Changes
            </Button>
          )}

          {/* Navigation — Gallery, Favorites, Reports, Comments */}
          <div className="flex items-center gap-0.5 border-l border-neutral-700/50 pl-2 ml-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => router.push("/gallery")}>
                  <Images className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gallery</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => router.push("/loved")}>
                  <Heart className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Favorites</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => router.push("/reports")}>
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reports</TooltipContent>
            </Tooltip>
            <CommentsNavigationIcon />
          </div>

          {/* Save status */}
          <span className="text-neutral-400 mx-1.5">
            {isProjectConfigured ? (
              isSaving ? "Saving..." : lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : "Not saved"
            ) : (
              "Not saved"
            )}
          </span>

          {/* User Menu — personal actions, system, logout */}
          <div ref={userMenuRef} className="relative border-l border-neutral-700/50 pl-1 ml-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="text-[var(--text-secondary)]"
                >
                  <CircleUser className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Account & Settings</TooltipContent>
            </Tooltip>

            {showUserMenu && (
              <div
                className="absolute top-full right-0 mt-1 w-52 rounded-lg shadow-lg py-1 z-50"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShortcutsDialogOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <Keyboard className="w-4 h-4" />
                  Keyboard Shortcuts
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowCredits(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <Info className="w-4 h-4" />
                  Credits & About
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    useOnboardingStore.getState().resetWizard();
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <HelpCircle className="w-4 h-4" />
                  Restart Tutorial
                </button>
                {currentUser?.role && (currentUser.role === "admin" || currentUser.role === "dept_admin") && (
                  <>
                    <div className="h-px my-1" style={{ background: "var(--border)" }} />
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowAdminPanel(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      aria-label="Open admin panel"
                    >
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </button>
                  </>
                )}
                <div className="h-px my-1" style={{ background: "var(--border)" }} />
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
                    window.location.href = "/login";
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <KeyboardShortcutsDialog
        isOpen={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
      />
      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />
      {showSaveAsTemplateModal && (
        <SaveAsTemplateModal
          isOpen={showSaveAsTemplateModal}
          onClose={() => setShowSaveAsTemplateModal(false)}
          onSaved={(slug) => {
            setShowSaveAsTemplateModal(false);
          }}
          currentNodes={nodes}
          currentEdges={edges}
          currentEdgeStyle={edgeStyle}
          currentGroups={Object.values(groups)}
          currentWorkflowName={workflowName}
        />
      )}
      <NodePackManager open={nodePackManagerOpen} onOpenChange={setNodePackManagerOpen} />
      {currentUser?.role && (currentUser.role === "admin" || currentUser.role === "dept_admin") && (
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          userRole={currentUser.role as "admin" | "dept_admin"}
        />
      )}
    </TooltipProvider>
  );
}
