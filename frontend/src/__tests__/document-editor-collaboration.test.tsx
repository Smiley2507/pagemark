import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forwardRef, useEffect, useImperativeHandle } from 'react';

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  getSections: vi.fn(),
  getFreshness: vi.fn(),
  getProject: vi.fn(),
  autosaveCalls: [] as Array<{
    projectId: number;
    documentId: number;
    sectionId: number | null;
    content: string;
    enabled: boolean;
  }>,
  editorMounts: new Map<number, number>(),
}));

vi.mock('@/components/editor/MarkdownEditor', () => ({
  MarkdownEditor: forwardRef((props: any, ref) => {
    useEffect(() => {
      mocks.editorMounts.set(props.sectionId, (mocks.editorMounts.get(props.sectionId) ?? 0) + 1);
    }, [props.sectionId]);

    useImperativeHandle(ref, () => ({
      focus: vi.fn(),
      insertContent: vi.fn(),
      replaceSelection: vi.fn(),
      insertAt: vi.fn(),
      replaceRange: vi.fn(),
      setContent: vi.fn(),
      setGrammarIssues: vi.fn(),
    }));

    return (
      <div
        data-testid={`mock-editor-${props.sectionId}`}
        data-collaboration={String(Boolean(props.collaboration))}
        tabIndex={0}
        onFocus={() => props.onFocusChange?.({
          state: {
            selection: { empty: true, to: 1, from: 1 },
            doc: { textBetween: vi.fn(() => '') },
          },
        })}
      />
    );
  }),
}));

vi.mock('@/components/editor/AiPanel', () => ({ AiPanel: () => null }));
vi.mock('@/components/editor/AiPanelHistoryTab', () => ({ AiPanelHistoryTab: () => null }));
vi.mock('@/components/editor/NotesSlideOver', () => ({ NotesSlideOver: () => null }));
vi.mock('@/components/editor/ResourcePalette', () => ({ ResourcePalette: () => null }));
vi.mock('@/components/editor/QualityModal', () => ({ QualityModal: () => null }));
vi.mock('@/components/editor/ExportModal', () => ({ ExportModal: () => null }));
vi.mock('@/components/shared/ShareDialog', () => ({ ShareDialog: () => null }));
vi.mock('@/components/editor/OutlineDiffBanner', () => ({ OutlineDiffBanner: () => null }));
vi.mock('@/components/editor/VersionHistory', () => ({ VersionHistory: () => null }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined }));
vi.mock('@/hooks/useNotes', () => ({ useNotes: () => ({ data: [] }) }));
vi.mock('@/hooks/useAI', () => ({ useAiProposedChanges: () => ({ data: [] }) }));
vi.mock('@/hooks/useQuality', () => ({
  useQualityReport: () => ({ data: null }),
  useRunQuality: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ user: { id: 1, email: 'user@example.com', name: 'User' } }),
}));
vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ theme: 'light', setTheme: vi.fn() }),
}));
vi.mock('@/store/viewPreferenceStore', () => ({
  useViewPreferenceStore: (selector: any) => selector({ recordRecentWork: vi.fn() }),
}));
vi.mock('@/api/documents', () => ({
  documentsApi: {
    getDocument: mocks.getDocument,
    getSections: mocks.getSections,
    getFreshness: mocks.getFreshness,
    updateDocument: vi.fn(),
    createSection: vi.fn(),
    reorderDocumentSections: vi.fn(),
    updateDocumentSectionTitle: vi.fn(),
    deleteDocumentSection: vi.fn(),
    acceptFreshnessUpdate: vi.fn(),
    rejectFreshnessUpdate: vi.fn(),
  },
}));
vi.mock('@/api/projects', () => ({
  projectsApi: {
    getProject: mocks.getProject,
  },
}));
vi.mock('@/hooks/useSections', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useSections')>('@/hooks/useSections');
  return {
    ...actual,
    useDocumentSections: () => ({ data: mocks.getSections(), isLoading: false }),
    useDocumentAutosave: (
      projectId: number,
      documentId: number,
      sectionId: number | null,
      content: string,
      enabled: boolean,
    ) => {
      mocks.autosaveCalls.push({ projectId, documentId, sectionId, content, enabled });
      return {
        isSaving: false,
        lastSaved: null,
        markPersisted: vi.fn(),
      };
    },
    useUpdateDocumentSection: () => ({ mutate: vi.fn(), isPending: false }),
    useAcceptSectionReview: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

import { DocumentEditorPage } from '@/pages/DocumentEditorPage';

function section(id: number, heading: string) {
  return {
    id,
    document_id: 10,
    order_index: id,
    sort_order: id,
    heading,
    title: heading,
    content_md: `# ${heading}\n\nContent`,
    status: 'draft' as const,
    children: [],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/1/documents/10']}>
        <Routes>
          <Route path="/projects/:projectId/documents/:documentId" element={<DocumentEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Document editor collaboration activation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COLLABORATION_ENABLED', 'true');
    vi.clearAllMocks();
    mocks.autosaveCalls.length = 0;
    mocks.editorMounts.clear();
    globalThis.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
      root: null,
      rootMargin: '',
      thresholds: [],
    })) as any;

    mocks.getDocument.mockResolvedValue({
      id: 10,
      project_id: 1,
      title: 'Doc',
      status: 'draft',
      progress: { total_sections: 2, reviewed_sections: 0, generated_sections: 0, pct: 0 },
      tags: [],
      setup_stage: 'draft',
      freshness: 'fresh',
      last_activity_at: '',
      created_at: '',
      updated_at: '',
    });
    mocks.getProject.mockResolvedValue({ id: 1, name: 'Project' });
    mocks.getFreshness.mockResolvedValue(null);
    mocks.getSections.mockReturnValue({
      document_id: 10,
      status: 'draft',
      sections: [section(101, 'Intro'), section(102, 'Details')],
    });
  });

  it('keeps collaboration on the collaboration section when another section is clicked', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('mock-editor-101')).toHaveAttribute('data-collaboration', 'true');
      expect(screen.getByTestId('mock-editor-102')).toHaveAttribute('data-collaboration', 'false');
    });

    expect(mocks.editorMounts.get(102)).toBe(1);

    fireEvent.pointerDown(screen.getByTestId('editor-section-102'));
    fireEvent.focus(screen.getByTestId('mock-editor-102'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-editor-101')).toHaveAttribute('data-collaboration', 'true');
      expect(screen.getByTestId('mock-editor-102')).toHaveAttribute('data-collaboration', 'false');
    });
    expect(mocks.editorMounts.get(102)).toBe(1);
  });

  it('uses normal autosave for every editable section when collaboration is enabled', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('mock-editor-101')).toHaveAttribute('data-collaboration', 'true');
      expect(screen.getByTestId('mock-editor-102')).toHaveAttribute('data-collaboration', 'false');
    });

    expect(mocks.autosaveCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ sectionId: 101, enabled: true }),
      expect.objectContaining({ sectionId: 102, enabled: true }),
    ]));
  });
});
