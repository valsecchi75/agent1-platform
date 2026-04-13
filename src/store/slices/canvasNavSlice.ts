import type { StateCreator } from "zustand";
import type { CanvasNavigationSettings } from "@/types";
import {
  getCanvasNavigationSettings,
  saveCanvasNavigationSettings,
} from "../utils/localStorage";

export interface CanvasNavSlice {
  canvasNavigationSettings: CanvasNavigationSettings;
  updateCanvasNavigationSettings: (settings: CanvasNavigationSettings) => void;
}

export const createCanvasNavSlice: StateCreator<CanvasNavSlice, [], [], CanvasNavSlice> = (set) => ({
  canvasNavigationSettings: getCanvasNavigationSettings(),

  updateCanvasNavigationSettings: (settings: CanvasNavigationSettings) => {
    set({ canvasNavigationSettings: settings });
    saveCanvasNavigationSettings(settings);
  },
});
