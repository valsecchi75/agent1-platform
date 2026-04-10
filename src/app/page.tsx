"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useCallback } from "react";
import { AnnotationModal } from "@/components/AnnotationModal";
import { FloatingActionBar } from "@/components/FloatingActionBar";
import { Header } from "@/components/Header";
import { UpdateBanner } from "@/components/UpdateBanner";
import { DevNodePackOpener } from "@/components/node-packs/DevNodePackOpener";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { WorkflowTabs } from "@/components/WorkflowTabs";
import { useTabStore } from "@/store/tabStore";
import { useWorkflowStore } from "@/store/workflowStore";

export default function Home() {
  const initializeAutoSave = useWorkflowStore(
    (state) => state.initializeAutoSave
  );
  const cleanupAutoSave = useWorkflowStore((state) => state.cleanupAutoSave);
  const fetchCurrentUser = useWorkflowStore(
    (state) => state.fetchCurrentUser
  );

  useEffect(() => {
    initializeAutoSave();
    fetchCurrentUser();
    return () => cleanupAutoSave();
  }, [initializeAutoSave, cleanupAutoSave, fetchCurrentUser]);

  // Warn on close if ANY tab has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const wfUnsaved = useWorkflowStore.getState().hasUnsavedChanges;
      const tabsUnsaved = useTabStore.getState().tabs.some((t) => t.hasUnsavedChanges);
      if (wfUnsaved || tabsUnsaved) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Keyboard shortcuts for tabs
  const addTab = useTabStore((state) => state.addTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const tabs = useTabStore((state) => state.tabs);
  const switchTab = useTabStore((state) => state.switchTab);

  const handleTabKeyboard = useCallback(
    (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      // Ctrl+T — new tab
      if (e.key === "t") {
        e.preventDefault();
        addTab();
        return;
      }

      // Ctrl+W — close active tab
      if (e.key === "w") {
        e.preventDefault();
        closeTab(activeTabId);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs
      if (e.key === "Tab") {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIndex === -1) return;
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        switchTab(tabs[nextIndex].id);
        return;
      }

      // Ctrl+1..9 — switch to tab N
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= tabs.length) {
        e.preventDefault();
        switchTab(tabs[num - 1].id);
      }
    },
    [addTab, closeTab, activeTabId, tabs, switchTab]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleTabKeyboard);
    return () => window.removeEventListener("keydown", handleTabKeyboard);
  }, [handleTabKeyboard]);

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <UpdateBanner />
        <Header />
        <WorkflowTabs />
        <WorkflowCanvas />
        <FloatingActionBar />
        <AnnotationModal />
        <DevNodePackOpener />
      </div>
    </ReactFlowProvider>
  );
}
