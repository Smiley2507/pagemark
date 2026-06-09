import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiMode = 'chat' | 'generate' | 'refine' | 'expand' | 'auto';
export type AiModelId =
  | 'claude-sonnet-4-5'
  | 'claude-3-5-sonnet'
  | 'claude-3-opus'
  | 'claude-3-haiku'
  | 'gpt-5'
  | 'gemini-2-0'
  | 'local';

export interface AiModelOption {
  id: AiModelId;
  label: string;
  provider: string;
}

export interface AiAttachment {
  id: string;
  type: 'file' | 'note' | 'section' | 'document' | 'source' | 'template' | 'transient';
  label: string;
  reference?: string;
  resourceId?: number;
}

export const AVAILABLE_MODELS: AiModelOption[] = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-haiku', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
  { id: 'gemini-2-0', label: 'Gemini 2.0', provider: 'Google' },
  { id: 'local', label: 'Local Model', provider: 'Local' },
];

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
  activeModelId: AiModelId;
  activeMode: AiMode;
  contextBarOpen: boolean;
  attachments: AiAttachment[];

  setActiveModelId: (id: AiModelId) => void;
  setActiveMode: (mode: AiMode) => void;
  setContextBarOpen: (open: boolean) => void;
  addAttachment: (attachment: AiAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      activeModelId: 'claude-sonnet-4-5',
      activeMode: 'chat',
      contextBarOpen: true,
      attachments: [],

      setActiveModelId: (id) => set({ activeModelId: id }),
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
        activeModelId: state.activeModelId,
        activeMode: state.activeMode,
      }),
    },
  ),
);
