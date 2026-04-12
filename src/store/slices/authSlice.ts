import type { StateCreator } from "zustand";

export interface CurrentUser {
  userId: string;
  username: string;
  role: "admin" | "dept_admin" | "user";
  departmentId: string | null;
  departmentName: string | null;
}

export interface AuthSlice {
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  fetchCurrentUser: () => Promise<void>;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set
) => ({
  currentUser: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  fetchCurrentUser: async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        set({ currentUser: null });
        return;
      }
      const data = await res.json();
      if (data.user) {
        set({
          currentUser: {
            userId: data.user.userId,
            username: data.user.username,
            role: data.user.role || "user",
            departmentId: data.user.departmentId || null,
            departmentName: data.user.departmentName || null,
          },
        });
      }
    } catch {
      set({ currentUser: null });
    }
  },
});
