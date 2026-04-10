"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PromptWorkflowView } from "./PromptWorkflowView";
import { QuickstartInitialView } from "./QuickstartInitialView";
import { TemplateExplorerView } from "./TemplateExplorerView";
import { WorkflowFile, useWorkflowStore } from "@/store/workflowStore";
import { useTabStore } from "@/store/tabStore";
import { QuickstartView } from "@/types/quickstart";

interface WelcomeModalProps {
  onWorkflowGenerated: (workflow: WorkflowFile) => void;
  onClose: () => void;
  onNewProject: () => void;
}

export function WelcomeModal({
  onWorkflowGenerated,
  onClose,
  onNewProject,
}: WelcomeModalProps) {
  const quickstartInitialView = useWorkflowStore((state) => state.quickstartInitialView);
  const [currentView, setCurrentView] = useState<QuickstartView>("initial");

  // If store has a specific initial view, jump to it
  useEffect(() => {
    if (quickstartInitialView) {
      setCurrentView(quickstartInitialView);
    } else {
      setCurrentView("initial");
    }
  }, [quickstartInitialView]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewProject = useCallback(() => {
    onNewProject();
  }, [onNewProject]);

  const handleSelectTemplates = useCallback(() => {
    setCurrentView("templates");
  }, []);

  const handleSelectVibe = useCallback(() => {
    setCurrentView("vibe");
  }, []);

  const handleSelectLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workflow = JSON.parse(
            event.target?.result as string
          ) as WorkflowFile;
          if (workflow.version && workflow.nodes && workflow.edges) {
            onWorkflowGenerated(workflow);
          } else {
            alert("Invalid workflow file format");
          }
        } catch {
          alert("Failed to parse workflow file");
        }
      };
      reader.readAsText(file);

      // Reset input so same file can be loaded again
      e.target.value = "";
    },
    [onWorkflowGenerated]
  );

  /** Load last workflow that generated an image (from session file on disk) */
  const handleLoadLastWorkflow = useCallback(async () => {
    try {
      const res = await fetch("/api/db/last-workflow");
      const data = await res.json();
      if (data.success && data.workflow) {
        const workflow = data.workflow as WorkflowFile;
        // The workflow comes from session persistence — may have nodes/edges directly
        if (workflow.nodes && workflow.edges) {
          // Ensure version field exists
          if (!workflow.version) workflow.version = 1;
          onWorkflowGenerated(workflow);
        } else {
          alert("Last workflow file is invalid");
        }
      } else {
        alert("No recent workflow found");
      }
    } catch {
      alert("Failed to load last workflow");
    }
  }, [onWorkflowGenerated]);

  /** Restore all tabs from the last saved session (file-based) */
  const handleRestoreSession = useCallback(async () => {
    try {
      // Use the new file-based restore endpoint (hydrates images from disk)
      const res = await fetch("/api/session/restore");
      const data = await res.json();
      if (!data.success || !data.session?.tabs?.length) {
        alert("No saved session found");
        return;
      }

      const { tabs, activeTabId } = data.session;
      const tabStore = useTabStore.getState();
      const workflowStore = useWorkflowStore.getState();

      // Find the tab to activate first (the one that was active last time)
      const activeTab = tabs.find((t: { id: string }) => t.id === activeTabId) || tabs[0];

      // Load the active tab's snapshot into the main workflow store
      if (activeTab?.snapshot) {
        const snapshot = activeTab.snapshot;
        workflowStore.loadWorkflow(
          {
            version: 1,
            id: snapshot.workflowId || undefined,
            name: snapshot.workflowName || "Restored Workflow",
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            edgeStyle: snapshot.edgeStyle,
            groups: snapshot.groups,
          },
          snapshot.saveDirectoryPath || undefined,
          { preserveSnapshot: true }
        );
      }

      // Set up the tab store with all tabs (each has its hydrated snapshot)
      useTabStore.setState({
        tabs: tabs.map((t: { id: string; label: string; hasUnsavedChanges: boolean; snapshot: object | null }) => ({
          ...t,
          // Clear the active tab's snapshot (it's now the live state)
          snapshot: t.id === activeTab.id ? null : t.snapshot,
        })),
        activeTabId: activeTab.id,
      });

      // Sync active tab state
      tabStore.syncActiveTabState();

      onClose();
    } catch (err) {
      console.error("Failed to restore session:", err);
      alert("Failed to restore session");
    }
  }, [onClose]);

  const handleBack = useCallback(() => {
    setCurrentView("initial");
  }, []);

  const handleWorkflowSelected = useCallback(
    (workflow: WorkflowFile) => {
      onWorkflowGenerated(workflow);
    },
    [onWorkflowGenerated]
  );

  // Template explorer needs more width for two-column layout
  const dialogWidth = currentView === "templates" ? "max-w-6xl" : "max-w-2xl";
  const dialogHeight = currentView === "templates" ? "max-h-[85vh]" : "max-h-[80vh]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onWheelCapture={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div className={`welcome-glow w-full ${dialogWidth} mx-4`} onClick={(e) => e.stopPropagation()}>
      <div className={`relative z-10 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] shadow-2xl overflow-clip ${dialogHeight} flex flex-col`}>
        {currentView === "initial" && (
          <QuickstartInitialView
            onNewProject={handleNewProject}
            onSelectTemplates={handleSelectTemplates}
            onSelectVibe={handleSelectVibe}
            onSelectLoad={handleSelectLoad}
            onLoadLastWorkflow={handleLoadLastWorkflow}
            onRestoreSession={handleRestoreSession}
          />
        )}
        {currentView === "templates" && (
          <TemplateExplorerView
            onBack={handleBack}
            onWorkflowSelected={handleWorkflowSelected}
          />
        )}
        {currentView === "vibe" && (
          <PromptWorkflowView
            onBack={handleBack}
            onWorkflowGenerated={handleWorkflowSelected}
          />
        )}
        {/* Hidden file input for loading workflows */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
      </div>
      </div>
    </div>
  );
}
