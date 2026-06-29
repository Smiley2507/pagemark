import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AiPanelHistoryTab } from '@/components/editor/AiPanelHistoryTab';
import { AiPanelContextBar } from '@/components/editor/ai/AiPanelContextBar';
import { useAiStore } from '@/store/aiStore';
import type { AIProposedChange } from '@/api/ai';

const acceptMutate = vi.fn();
const rejectMutate = vi.fn();
const undoMutate = vi.fn();
let proposedChanges: AIProposedChange[] = [];

vi.mock('@/hooks/useAI', () => ({
  useAcceptAiProposedChange: () => ({ mutate: acceptMutate, isPending: false }),
  useAiProposedChanges: () => ({ data: proposedChanges, isLoading: false }),
  useRejectAiProposedChange: () => ({ mutate: rejectMutate, isPending: false }),
  useUndoAiWorkRun: () => ({ mutate: undoMutate, isPending: false }),
}));

vi.mock('@/components/editor/ai/AiProposedChangeCard', () => ({
  AiProposedChangeCard: ({
    change,
    onAccept,
    onReject,
    onUndo,
  }: {
    change: AIProposedChange;
    onAccept: (changeId: number) => void;
    onReject: (changeId: number) => void;
    onUndo: (runId: number) => void;
  }) => (
    <article data-testid={`change-card-${change.id}`}>
      <h4>{change.title}</h4>
      {change.status === 'proposed' && (
        <>
          <button onClick={() => onAccept(change.id)}>Accept {change.id}</button>
          <button onClick={() => onReject(change.id)}>Reject {change.id}</button>
        </>
      )}
      {change.status === 'accepted' && (
        <button onClick={() => onUndo(change.work_run_id)}>Undo {change.work_run_id}</button>
      )}
    </article>
  ),
}));

const getAiContext = vi.fn();

vi.mock('@/api/projects', () => ({
  projectsApi: {
    getAiContext: (...args: unknown[]) => getAiContext(...args),
  },
}));

function makeChange(id: number, status: AIProposedChange['status'], title: string): AIProposedChange {
  return {
    id,
    work_run_id: id + 100,
    document_id: 1,
    section_id: 11,
    change_type: 'rewrite_selection',
    status,
    title,
    rationale: null,
    before: { content_md: 'Before' },
    after: { content_md: 'After' },
    preview_markdown: 'After',
    created_at: '2026-06-21T00:00:00Z',
  };
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  proposedChanges = [];
  useAiStore.setState({
    contextBarOpen: true,
    attachments: [],
    turns: [],
  });
});

describe('AI Changes tab', () => {
  it('renders open proposed changes before closed changes and keeps card actions wired', () => {
    proposedChanges = [
      makeChange(2, 'accepted', 'Accepted rewrite'),
      makeChange(1, 'proposed', 'Open rewrite'),
      makeChange(3, 'rejected', 'Rejected rewrite'),
    ];

    renderWithProviders(<AiPanelHistoryTab projectId={1} documentId={1} />);

    const cards = screen.getAllByTestId(/change-card-/);
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('Open rewrite'),
      expect.stringContaining('Accepted rewrite'),
      expect.stringContaining('Rejected rewrite'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Accept 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo 102' }));

    expect(acceptMutate).toHaveBeenCalledWith(1);
    expect(rejectMutate).toHaveBeenCalledWith(1);
    expect(undoMutate).toHaveBeenCalledWith(102);
  });
});

describe('AI context bar', () => {
  it('renders a compact summary and keeps preview, remove, and clear-all in the popover', async () => {
    getAiContext.mockResolvedValue({
      project: {
        id: 1,
        name: 'Pagemark',
        source_type: 'git',
      },
      project_brief: 'Build docs from code.',
      analysis_summary: {
        status: 'completed',
        is_current: true,
        total_files: 42,
        languages: ['TypeScript'],
        frameworks: ['React'],
        endpoint_count: 4,
        dependency_count: 9,
        largest_files: [],
      },
      source_connection: {},
      facts: {},
      unavailable_facts: [],
      partial_failures: [],
      effective_exclusions: [],
      context_files_preview: [],
      grounding_warnings: [],
    });
    useAiStore.setState({
      attachments: [
        { id: 'file-1', type: 'file', label: 'Architecture.md', reference: 'docs/Architecture.md', resourceId: 9 },
        { id: 'note-1', type: 'note', label: 'Launch notes', reference: 'Release notes' },
      ],
    });

    renderWithProviders(
      <AiPanelContextBar
        projectId={1}
        activeSectionHeading="Overview"
        activeSectionStatus="draft"
        hasQualityContext
      />,
    );

    await screen.findByText('Using 8 context items');
    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Files 1')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Using 8 context items'));
    const popover = screen.getByText('AI context').closest('div')?.parentElement;
    expect(popover).toBeTruthy();
    expect(screen.getByText('Project brief')).toBeInTheDocument();
    expect(screen.getByText('Latest analysis')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Architecture.md/ })[0]);
    expect(screen.getByText('ID: 9')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove Architecture.md'));
    await waitFor(() => expect(screen.queryByText('Architecture.md')).not.toBeInTheDocument());
    expect(useAiStore.getState().attachments).toHaveLength(1);

    fireEvent.click(within(screen.getByText('AI context').closest('div')!.parentElement!).getByText('Clear all'));
    await waitFor(() => expect(useAiStore.getState().attachments).toHaveLength(0));
  });
});
