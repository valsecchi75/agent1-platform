/**
 * authSlice.ts — Auth state for multi-user isolation
 *
 * Stores the current user's info (fetched from /api/auth/me) so React
 * components can access currentUser.userId, currentUser.role, etc.
 */

import { StateCreator } from "zustand";

export interface CurrentUser {
  userId: string;
  username: string;
  role: "admin" | "user";
}

export interface AuthSlice {
  currentUser: CurrentUser | null;
  isAuthLoading: boolean;
  fetchCurrentUser: () => Promise<void>;
  clearCurrentUser: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  currentUser: null,
  isAuthLoading: true,

  fetchCurrentUser: async () => {
    try {
      set({ isAuthLoading: true });
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        set({
          currentUser: {
            userId: data.userId,
            username: data.username,
            role: data.role,
          },
          isAuthLoading: false,
        });
      } else {
        set({ currentUser: null, isAuthLoading: false });
      }
    } catch {
      set({ currentUser: null, isAuthLoading: false });
    }
  },

  clearCurrentUser: () => set({ currentUser: null, isAuthLoading: false }),
});
