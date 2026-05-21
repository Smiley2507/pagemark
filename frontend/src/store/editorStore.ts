import { create } from 'zustand';

interface EditorState {
  activeSectionId: number | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  editorMode: 'view' | 'edit' | 'refine';
  setActiveSection: (id: number | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setEditorMode: (mode: 'view' | 'edit' | 'refine') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeSectionId: null,
  leftPanelOpen: true,
  rightPanelOpen: true,
  editorMode: 'view',
  setActiveSection: (id) => set({ activeSectionId: id }),
  toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setEditorMode: (mode) => set({ editorMode: mode }),
}));
