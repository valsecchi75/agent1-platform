import type { StateCreator } from "zustand";
import type { ProviderType, ProviderSettings, RecentModel } from "@/types";
import {
  getProviderSettings,
  saveProviderSettings,
  getRecentModels,
  saveRecentModels,
  MAX_RECENT_MODELS,
} from "../utils/localStorage";

export interface ProviderSlice {
  providerSettings: ProviderSettings;
  updateProviderSettings: (settings: ProviderSettings) => void;
  updateProviderApiKey: (providerId: ProviderType, apiKey: string | null) => void;
  toggleProvider: (providerId: ProviderType, enabled: boolean) => void;

  recentModels: RecentModel[];
  trackModelUsage: (model: { provider: ProviderType; modelId: string; displayName: string }) => void;
}

export const createProviderSlice: StateCreator<ProviderSlice, [], [], ProviderSlice> = (set, get) => ({
  providerSettings: getProviderSettings(),
  recentModels: getRecentModels(),

  updateProviderSettings: (settings: ProviderSettings) => {
    set({ providerSettings: settings });
    saveProviderSettings(settings);
  },

  updateProviderApiKey: (providerId: ProviderType, apiKey: string | null) => {
    const { providerSettings } = get();
    const updated: ProviderSettings = {
      providers: {
        ...providerSettings.providers,
        [providerId]: {
          ...providerSettings.providers[providerId],
          apiKey,
        },
      },
    };
    set({ providerSettings: updated });
    saveProviderSettings(updated);
  },

  toggleProvider: (providerId: ProviderType, enabled: boolean) => {
    const { providerSettings } = get();
    const updated: ProviderSettings = {
      providers: {
        ...providerSettings.providers,
        [providerId]: {
          ...providerSettings.providers[providerId],
          enabled,
        },
      },
    };
    set({ providerSettings: updated });
    saveProviderSettings(updated);
  },

  trackModelUsage: (model: { provider: ProviderType; modelId: string; displayName: string }) => {
    const current = get().recentModels;
    const filtered = current.filter((m) => m.modelId !== model.modelId);
    const updated: RecentModel[] = [
      {
        provider: model.provider,
        modelId: model.modelId,
        displayName: model.displayName,
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_MODELS);
    saveRecentModels(updated);
    set({ recentModels: updated });
  },
});
