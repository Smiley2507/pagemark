import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
  token: string | null;
  expiresAt: string | null;
  lastActivityAt: string | null;
  timeoutMinutes: number;

  setSession: (token: string, expiresInMinutes: number) => void;
  touchActivity: () => void;
  clearSession: () => void;
  isExpired: () => boolean;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      lastActivityAt: null,
      timeoutMinutes: 10,

      setSession: (token, expiresInMinutes) => {
        const now = new Date();
        set({
          token,
          expiresAt: new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString(),
          lastActivityAt: now.toISOString(),
          timeoutMinutes: expiresInMinutes,
        });
      },

      touchActivity: () => {
        set({ lastActivityAt: new Date().toISOString() });
      },

      clearSession: () => {
        set({ token: null, expiresAt: null, lastActivityAt: null });
      },

      isExpired: () => {
        const state = get();
        if (!state.expiresAt || !state.lastActivityAt) return true;

        const now = Date.now();
        if (now > new Date(state.expiresAt).getTime()) return true;

        const inactivityMs = now - new Date(state.lastActivityAt).getTime();
        return inactivityMs > state.timeoutMinutes * 60 * 1000;
      },
    }),
    {
      name: 'pagemark-admin-store',
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
        lastActivityAt: state.lastActivityAt,
        timeoutMinutes: state.timeoutMinutes,
      }),
    },
  ),
);
