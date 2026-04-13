import type { StateCreator } from "zustand";
import { loadWorkflowCostData, saveWorkflowCostData } from "../utils/localStorage";

/**
 * CostSlice needs access to workflowId from the main store.
 * We use a minimal dependency interface so the slice stays portable.
 */
export interface CostSliceDeps {
  workflowId: string | null;
}

export interface CostSlice {
  incurredCost: number;
  addIncurredCost: (cost: number) => void;
  resetIncurredCost: () => void;
  loadIncurredCost: (workflowId: string) => void;
  saveIncurredCost: () => void;
}

export const createCostSlice: StateCreator<
  CostSlice & CostSliceDeps,
  [],
  [],
  CostSlice
> = (set, get) => ({
  incurredCost: 0,

  addIncurredCost: (cost: number) => {
    set((state) => ({ incurredCost: state.incurredCost + cost }));
    get().saveIncurredCost();
  },

  resetIncurredCost: () => {
    set({ incurredCost: 0 });
    get().saveIncurredCost();
  },

  loadIncurredCost: (workflowId: string) => {
    const data = loadWorkflowCostData(workflowId);
    set({ incurredCost: data?.incurredCost || 0 });
  },

  saveIncurredCost: () => {
    const { workflowId, incurredCost } = get();
    if (!workflowId) return;
    saveWorkflowCostData({
      workflowId,
      incurredCost,
      lastUpdated: Date.now(),
    });
  },
});
