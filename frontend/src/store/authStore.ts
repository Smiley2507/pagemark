import { create } from 'zustand';
import type { User } from '../types';

const PENDING_MFA_STORAGE_KEY = 'pagemark.pendingMfa';

export interface PendingMfaChallenge {
  email: string;
  message: string;
}

function readPendingMfa(): PendingMfaChallenge | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_MFA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingMfaChallenge>;
    if (!parsed.email || !parsed.message) return null;
    return { email: parsed.email, message: parsed.message };
  } catch {
    return null;
  }
}

function writePendingMfa(challenge: PendingMfaChallenge | null) {
  if (typeof window === 'undefined') return;
  try {
    if (challenge) {
      window.sessionStorage.setItem(PENDING_MFA_STORAGE_KEY, JSON.stringify(challenge));
    } else {
      window.sessionStorage.removeItem(PENDING_MFA_STORAGE_KEY);
    }
  } catch {
    // sessionStorage is best-effort; in-memory state still preserves the active page.
  }
}

interface AuthState {
  user: User | null;
  pendingMfa: PendingMfaChallenge | null;
  isLoading: boolean;
  showWelcome: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setPendingMfa: (challenge: PendingMfaChallenge) => void;
  clearPendingMfa: () => void;
  setLoading: (isLoading: boolean) => void;
  setShowWelcome: (show: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  pendingMfa: readPendingMfa(),
  isLoading: false,
  showWelcome: false,
  setUser: (user) => {
    if (user) writePendingMfa(null);
    set((state) => ({ user, pendingMfa: user ? null : state.pendingMfa }));
  },
  clearUser: () => set({ user: null, showWelcome: false }),
  setPendingMfa: (challenge) => {
    writePendingMfa(challenge);
    set({ pendingMfa: challenge });
  },
  clearPendingMfa: () => {
    writePendingMfa(null);
    set({ pendingMfa: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setShowWelcome: (show) => set({ showWelcome: show }),
}));
