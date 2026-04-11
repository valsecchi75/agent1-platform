"use client";

import {
  BarChart3,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Heart,
  HelpCircle,
  Images,
  Key,
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
  User,
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
import { formatVersion, versionLabel, buildInfo } from "@/lib/appVersion";
import { useTabStore } from "@/store/tabStore";
import { useWorkflowStore, WorkflowFile } from "@/store/workflowStore";

import { NodePackManager } from "@/components/node-packs";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { CostIndicator } from "./CostIndicator";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ProjectSetupModal } from "./ProjectSetupModal";
import { SaveAsTemplateModal } from "./SaveAsTemplateModal";
import { ApiKeyPanel } from "./settings/ApiKeyPanel";
import { BrandLogo } from "./settings/BrandLogo";
import { CreditsModal } from "./settings/CreditsModal";
import { ThemeSwitcher } from "./settings/ThemeSwitcher";
import { UserProfile } from "./user/UserProfile";
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
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [nodePackManagerOpen, setNodePackManagerOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const nodePackBadge = useWorkflowStore((s) => s.nodePackBadgeActive);
  const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);
  const currentUser = useWorkflowStore((s) => s.currentUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

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
    function handleClickOutside(e: MouseEvent) {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    }
    if (showSaveMenu || showSettingsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSaveMenu, showSettingsMenu]);

  const settingsButtons = (
    <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-neutral-700/50">
      {(currentUser?.role === "admin" || currentUser?.role === "dept_admin") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setShowAdminPanel(true)}>
              <Shield className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Admin Panel</TooltipContent>
        </Tooltip>
      )}
      <ThemeSwitcher />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setShowApiKeys(true)}>
            <Key className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>API Key Settings</TooltipContent>
      </Tooltip>
      <div ref={settingsMenuRef} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsMenu((prev) => !prev)}
              className="relative"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        {/* Settings dropdown menu */}
        {showSettingsMenu && (
          <div
            className="absolute top-full right-0 mt-1 w-48 rounded-lg shadow-lg py-1 z-50"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() => {
                setShowSettingsMenu(false);
                handleOpenSettings();
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              Project Settings
            </button>
            <div className="h-px" style={{ background: "var(--border)" }} />
            <button
              onClick={() => {
                setShowSettingsMenu(false);
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
          </div>
        )}
      </div>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-[8px] font-medium tracking-wider uppercase px-1 py-0.5 rounded ml-1.5 cursor-default"
                  style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                >
                  {formatVersion()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <span className="font-mono">{versionLabel()}</span>
                <br />
                <span style={{ opacity: 0.6 }}>Built {buildInfo().date} · {buildInfo().branch}</span>
              </TooltipContent>
            </Tooltip>
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
                  <div ref={saveMenuRef} className="relative flex items-center">
                    {/* Main Save button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => (canSave ? saveToFile() : handleOpenSettings())}
                          disabled={isSaving}
                          className="relative rounded-r-none"
                        >
                          <Save className="w-4 h-4" />
                          {hasUnsavedChanges && !isSaving && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-neutral-900" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isSaving ? "Saving..." : canSave ? "Save project" : "Configure save location"}
                      </TooltipContent>
                    </Tooltip>

                    {/* Dropdown arrow */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSaveMenu((prev) => !prev)}
                      className="w-5 h-8 rounded-l-none border-l border-neutral-700/50 px-0"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>

                    {/* Dropdown menu */}
                    {showSaveMenu && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg py-1 z-50">
                        <button
                          onClick={() => {
                            setShowSaveMenu(false);
                            const newName = prompt("Save as:", workflowName || "");
                            if (newName && newName.trim()) {
                              saveAsFile(newName.trim());
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 hover:text-neutral-100 transition-colors"
                        >
                          Save As...
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveMenu(false);
                            setShowSaveAsTemplateModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 hover:text-neutral-100 transition-colors"
                        >
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

        <div className="flex items-center gap-3 text-xs">
          {previousWorkflowSnapshot && (
            <Button variant="outline" size="sm" onClick={handleRevertAIChanges}>
              <RotateCcw className="w-3 h-3" />
              Revert AI Changes
            </Button>
          )}
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <div className="flex items-center gap-0.5">
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
          </div>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <CommentsNavigationIcon />
          <span className="text-neutral-400">
            {isProjectConfigured ? (
              isSaving ? "Saving..." : lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : "Not saved"
            ) : (
              "Not saved"
            )}
          </span>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShortcutsDialogOpen(true)}
                className="text-[var(--text-secondary)]"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
          </Tooltip>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <button
            onClick={() => setShowCredits(true)}
            className="transition-colors text-xs"
            style={{ color: "var(--text-muted)" }}
            title="Credits &amp; About"
          >
            Credits
          </button>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <button
            onClick={() => setShowUserProfile(true)}
            className="transition-colors text-xs flex items-center gap-1 hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-muted)" }}
            title="User Profile"
          >
            <User className="w-3 h-3" />
            {currentUser?.username || 'Profile'}
          </button>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <button
            onClick={() => {
              document.cookie = "agent1_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              window.location.href = "/login";
            }}
            className="transition-colors text-xs flex items-center gap-1 hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-muted)" }}
            title="Logout"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </header>
      <KeyboardShortcutsDialog
        isOpen={shortcutsDialogOpen}
        onClose={() => setShortcutsDialogOpen(false)}
      />
      <ApiKeyPanel isOpen={showApiKeys} onClose={() => setShowApiKeys(false)} />
      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />
      <UserProfile open={showUserProfile} onOpenChange={setShowUserProfile} />
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
      <AdminPanel open={showAdminPanel} onOpenChange={setShowAdminPanel} />
    </TooltipProvider>
  );
}
