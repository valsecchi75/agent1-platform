import type { StateCreator } from "zustand";
import type { ProviderType } from "@/types";

// RAF debounce for hover updates
let hoverRafId: number | null = null;

export interface UISlice {
  // Modal state
  openModalCount: number;
  isModalOpen: boolean;
  incrementModalCount: () => void;
  decrementModalCount: () => void;

  // Quickstart
  showQuickstart: boolean;
  quickstartInitialView: "initial" | "templates" | "vibe" | null;
  setShowQuickstart: (show: boolean, initialView?: "initial" | "templates" | "vibe") => void;

  // Hover
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;

  // Model search dialog
  modelSearchOpen: boolean;
  modelSearchProvider: ProviderType | null;
  setModelSearchOpen: (open: boolean, provider?: ProviderType | null) => void;

  // Keyboard shortcuts dialog
  shortcutsDialogOpen: boolean;
  setShortcutsDialogOpen: (open: boolean) => void;

  // Node design mode
  nodeDesignMode: 'classic' | 'v2';
  setNodeDesignMode: (mode: 'classic' | 'v2') => void;

  // Update system
  updateInfo: {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseNotes: string | null;
    downloadUrl: string | null;
    publishedAt: string | null;
    error: string | null;
  } | null;
  updateProgress: {
    step: number | null;
    status: string | null;
    isUpdating: boolean;
    error: string | null;
  };
  setUpdateInfo: (info: UISlice['updateInfo']) => void;
  setUpdateProgress: (progress: Partial<UISlice['updateProgress']>) => void;
  dismissUpdate: () => void;
  updateDismissed: boolean;
}

/** Read persisted node design mode from localStorage (client-side only) */
function getInitialNodeDesignMode(): 'classic' | 'v2' {
  if (typeof window === 'undefined') return 'classic';
  const stored = localStorage.getItem('agent1-node-design');
  return stored === 'v2' ? 'v2' : 'classic';
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  openModalCount: 0,
  isModalOpen: false,
  showQuickstart: true,
  quickstartInitialView: null,
  hoveredNodeId: null,
  modelSearchOpen: false,
  modelSearchProvider: null,
  shortcutsDialogOpen: false,
  nodeDesignMode: getInitialNodeDesignMode(),
  updateInfo: null,
  updateProgress: { step: null, status: null, isUpdating: false, error: null },
  updateDismissed: false,

  incrementModalCount: () => {
    set((state) => {
      const newCount = state.openModalCount + 1;
      return { openModalCount: newCount, isModalOpen: newCount > 0 };
    });
  },

  decrementModalCount: () => {
    set((state) => {
      const newCount = Math.max(0, state.openModalCount - 1);
      return { openModalCount: newCount, isModalOpen: newCount > 0 };
    });
  },

  setShowQuickstart: (show: boolean, initialView?: "initial" | "templates" | "vibe") => {
    set({ showQuickstart: show, quickstartInitialView: initialView || null });
  },

  setHoveredNodeId: (id: string | null) => {
    if (hoverRafId !== null) cancelAnimationFrame(hoverRafId);
    hoverRafId = requestAnimationFrame(() => {
      hoverRafId = null;
      if (get().hoveredNodeId !== id) set({ hoveredNodeId: id });
    });
  },

  setModelSearchOpen: (open: boolean, provider?: ProviderType | null) => {
    set({
      modelSearchOpen: open,
      modelSearchProvider: provider ?? null,
    });
  },

  setShortcutsDialogOpen: (open: boolean) => {
    set({ shortcutsDialogOpen: open });
  },

  setNodeDesignMode: (mode: 'classic' | 'v2') => {
    set({ nodeDesignMode: mode });
    if (typeof window !== 'undefined') {
      localStorage.setItem('agent1-node-design', mode);
      document.documentElement.setAttribute('data-node-design', mode);
    }
  },

  setUpdateInfo: (info) =>
    set((state) => {
      // Only reset the dismiss flag when a genuinely new version is detected
      const newVersion = info?.latestVersion ?? null;
      const prevVersion = state.updateInfo?.latestVersion ?? null;
      const versionChanged = newVersion !== null && newVersion !== prevVersion;
      return {
        updateInfo: info,
        updateDismissed: versionChanged ? false : state.updateDismissed,
      };
    }),
  setUpdateProgress: (progress) =>
    set((state) => ({
      updateProgress: { ...state.updateProgress, ...progress },
    })),
  dismissUpdate: () => set({ updateDismissed: true }),
});
