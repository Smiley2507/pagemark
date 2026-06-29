import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentMarkdown: 'before',
  setContent: vi.fn(),
  onChange: vi.fn(),
  editor: null as any,
}));

vi.mock('@tiptap/react', () => ({
  useEditor: () => mocks.editor,
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@liveblocks/react/suspense', () => ({
  ClientSideSuspense: ({ children }: { children: ReactNode }) => <>{children}</>,
  RoomProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSelf: () => ({ info: { permission: 'edit' } }),
  useThreads: () => ({ threads: [] }),
}));

vi.mock('@liveblocks/react-tiptap', () => ({
  AnchoredThreads: () => null,
  FloatingComposer: () => null,
  FloatingThreads: () => null,
  useLiveblocksExtension: () => null,
}));

vi.mock('@/api/collaboration', () => ({
  collaborationApi: {
    authorize: vi.fn(),
    snapshotSection: vi.fn(),
  },
  sectionRoomId: vi.fn(() => 'room'),
}));

vi.mock('@/api/resources', () => ({
  resourcesApi: {
    upload: vi.fn(),
  },
}));

vi.mock('@/store/aiStore', () => ({
  useAiStore: {
    getState: () => ({ addAttachment: vi.fn() }),
  },
}));

vi.mock('@/components/editor/tiptap/SlashCommandMenu', () => ({
  SlashCommandMenu: () => null,
}));

vi.mock('@/components/editor/tiptap/TableToolbar', () => ({
  TableToolbar: () => null,
}));

vi.mock('@/components/editor/EditorContextMenu', () => ({
  EditorContextMenu: () => null,
}));

import { TipTapEditor } from '@/components/editor/tiptap/TipTapEditor';

describe('TipTap backend-applied sync', () => {
  beforeEach(() => {
    mocks.currentMarkdown = 'before';
    mocks.setContent.mockReset();
    mocks.onChange.mockReset();
    const dom = document.createElement('div');
    mocks.editor = {
      getMarkdown: vi.fn(() => mocks.currentMarkdown),
      commands: {
        setContent: mocks.setContent.mockImplementation((text: string) => {
          mocks.currentMarkdown = text;
        }),
        clearContent: vi.fn(),
      },
      setEditable: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      isActive: vi.fn(() => false),
      isFocused: false,
      state: {
        selection: { from: 1, to: 1 },
        doc: {
          textBetween: vi.fn(() => ''),
          resolve: vi.fn(),
        },
      },
      view: {
        dom,
        posAtCoords: vi.fn(),
      },
      chain: () => ({
        focus: () => ({ run: vi.fn() }),
      }),
    };
  });

  it('applies backend content once per backend-applied version', async () => {
    const { rerender } = render(
      <TipTapEditor
        value="before"
        onChange={mocks.onChange}
        backendAppliedContent="accepted"
        backendAppliedVersion="run-1"
      />,
    );

    await waitFor(() => {
      expect(mocks.setContent).toHaveBeenCalledTimes(1);
      expect(mocks.onChange).toHaveBeenCalledWith('accepted');
    });

    rerender(
      <TipTapEditor
        value="accepted"
        onChange={mocks.onChange}
        backendAppliedContent="accepted"
        backendAppliedVersion="run-1"
      />,
    );

    await waitFor(() => {
      expect(mocks.setContent).toHaveBeenCalledTimes(1);
      expect(mocks.onChange).toHaveBeenCalledTimes(1);
    });

    rerender(
      <TipTapEditor
        value="accepted"
        onChange={mocks.onChange}
        backendAppliedContent="new accepted"
        backendAppliedVersion="run-2"
      />,
    );

    await waitFor(() => {
      expect(mocks.setContent).toHaveBeenCalledTimes(2);
      expect(mocks.onChange).toHaveBeenCalledWith('new accepted');
    });
  });
});
