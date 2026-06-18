import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiMode = 'chat' | 'generate' | 'refine' | 'expand' | 'auto';

export interface AiAttachment {
  id: string;
  type: 'file' | 'note' | 'section' | 'document' | 'source' | 'template' | 'transient';
  label: string;
  reference?: string;
  referenceId?: number;
  resourceId?: number;
}

export const MODE_LABELS: Record<AiMode, string> = {
  chat: 'Chat',
  generate: 'Generate',
  refine: 'Refine',
  expand: 'Expand',
  auto: 'Auto',
};

export const MODE_DESCRIPTIONS: Record<AiMode, string> = {
  chat: 'Normal conversation with Mark',
  generate: 'Create new content from scratch',
  refine: 'Improve existing content',
  expand: 'Expand selected content with detail',
  auto: 'Let Mark decide the best action',
};

interface AiState {
  activeMode: AiMode;
  contextBarOpen: boolean;
  attachments: AiAttachment[];

  setActiveMode: (mode: AiMode) => void;
  setContextBarOpen: (open: boolean) => void;
  addAttachment: (attachment: AiAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      activeMode: 'chat',
      contextBarOpen: true,
      attachments: [],

      setActiveMode: (mode) => set({ activeMode: mode }),
      setContextBarOpen: (open) => set({ contextBarOpen: open }),
      addAttachment: (attachment) =>
        set((state) => ({
          attachments: [
            ...state.attachments.filter((a) => a.id !== attachment.id),
            attachment,
          ],
        })),
      removeAttachment: (id) =>
        set((state) => ({
          attachments: state.attachments.filter((a) => a.id !== id),
        })),
      clearAttachments: () => set({ attachments: [] }),
    }),
    {
      name: 'pagemark-ai-store',
      partialize: (state) => ({
        activeMode: state.activeMode,
      }),
    },
  ),
);
