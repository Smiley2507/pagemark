import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  showWelcome: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setLoading: (isLoading: boolean) => void;
  setShowWelcome: (show: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  showWelcome: false,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, showWelcome: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setShowWelcome: (show) => set({ showWelcome: show }),
}));
