import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPanel } from '@/components/editor/AiPanel';

const mutateAsync = vi.fn();
const updateContextMutate = vi.fn();
const suggestStructureMutate = vi.fn();
const workRunMutate = vi.fn();
const refineMutate = vi.fn();
const acceptMutate = vi.fn();
const rejectMutate = vi.fn();
const undoMutate = vi.fn();

vi.mock('@/components/editor/ai/AiPanelHeader', () => ({
  AiPanelHeader: () => <div data-testid="ai-header" />,
}));

vi.mock('@/components/editor/ai/AiPanelEmptyState', () => ({
  AiPanelEmptyState: () => <div data-testid="ai-empty-state" />,
}));

vi.mock('@/components/editor/ai/AiPanelContextBar', () => ({
  AiPanelContextBar: () => <div data-testid="ai-context-bar" />,
}));

vi.mock('@/components/editor/ai/AiPanelAttachments', () => ({
  AiPanelAttachments: () => <div data-testid="ai-attachments" />,
}));

vi.mock('@/components/editor/ai/AiPanelComposer', () => ({
  AiPanelComposer: ({
    value,
    onChange,
    onSend,
  }: {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
  }) => (
    <div>
      <input
        aria-label="ai prompt"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" onClick={onSend}>
        Send
      </button>
    </div>
  ),
}));

vi.mock('@/components/editor/DiffViewer', () => ({
  DiffViewer: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="diff-viewer">{oldText}{' -> '}{newText}</div>
  ),
}));

vi.mock('@/components/editor/StructuralSuggestions', () => ({
  StructuralSuggestions: () => <div data-testid="structural-suggestions" />,
}));

vi.mock('@/hooks/useAI', () => ({
  useAcceptAiProposedChange: () => ({ mutate: acceptMutate, isPending: false }),
  useAiProposedChanges: () => ({ data: [] }),
  useCreateAiChatAction: () => ({ mutateAsync }),
  useCreateAiWorkRun: () => ({ mutateAsync: workRunMutate, isPending: false }),
  useRefineSection: () => ({ mutateAsync: refineMutate, isPending: false }),
  useRejectAiProposedChange: () => ({ mutate: rejectMutate, isPending: false }),
  useSuggestStructure: () => ({ mutateAsync: suggestStructureMutate, isPending: false }),
  useUndoAiWorkRun: () => ({ mutate: undoMutate, isPending: false }),
  useUpdateProjectContext: () => ({ mutate: updateContextMutate, isPending: false }),
}));

vi.mock('@/hooks/useAiCredentials', () => ({
  useAiCredentials: () => ({
    data: {
      credentials: [
        {
          is_active: true,
          provider: 'openai',
          model_id: 'gpt-4.1-mini',
        },
      ],
    },
    isLoading: false,
  }),
  useAiProviderModels: () => ({
    data: { models: [{ id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }] },
  }),
}));

vi.mock('@/store/aiStore', () => ({
  useAiStore: {
    getState: () => ({
      activeMode: 'chat',
      attachments: [],
      removeAttachment: vi.fn(),
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPanel() {
  return render(
    <AiPanel
      projectId={1}
      documentId={1}
      activeSectionId={11}
      activeSectionHeading="Overview"
      activeSectionContent="Existing content"
      activeSectionStatus="draft"
      sections={[{ id: 11, heading: 'Overview' }]}
      projectName="Operator Guide"
      projectContextMd="Project brief"
    />,
  );
}

describe('AI panel turns', () => {
  it('renders a casual answer as a chat bubble', async () => {
    mutateAsync.mockResolvedValueOnce({
      message: 'This section explains the setup flow.',
      action: 'answer',
      work_run: null,
    });

    renderPanel();

    fireEvent.change(screen.getByLabelText('ai prompt'), { target: { value: 'What does this section explain?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByTestId('ai-panel-transcript')).toBeInTheDocument());
    const transcript = screen.getByTestId('ai-panel-transcript');

    expect(within(transcript).getByText('What does this section explain?')).toBeInTheDocument();
    expect(within(transcript).getByText('This section explains the setup flow.')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-proposed-change-101')).not.toBeInTheDocument();
  });

  it('renders a proposed change card directly under the assistant turn that created it', async () => {
    mutateAsync.mockResolvedValueOnce({
      message: 'Prepared an insertion for review.',
      action: 'insert_at_cursor',
      work_run: {
        id: 55,
        document_id: 1,
        status: 'proposed',
        prompt_context: {},
        proposed_changes: [
          {
            id: 101,
            work_run_id: 55,
            document_id: 1,
            section_id: 11,
            change_type: 'insert_at_cursor',
            status: 'proposed',
            title: 'Insert lifecycle note',
            rationale: 'Adds a concise lifecycle detail.',
            before: { section_id: 11, pos: 0 },
            after: { content_md: 'Inserted lifecycle note from AI.', pos: 0 },
            preview_markdown: 'Inserted lifecycle note from AI.',
            created_at: '2026-06-21T00:00:00Z',
          },
        ],
        created_at: '2026-06-21T00:00:00Z',
        updated_at: '2026-06-21T00:00:00Z',
      },
    });

    renderPanel();

    fireEvent.change(screen.getByLabelText('ai prompt'), { target: { value: 'Insert a paragraph here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByTestId('ai-turn-assistant-work_run')).toBeInTheDocument());

    const assistantTurn = screen.getByTestId('ai-turn-assistant-work_run');
    expect(within(assistantTurn).getByText('Prepared an insertion for review.')).toBeInTheDocument();
    expect(within(assistantTurn).getByTestId('ai-proposed-change-101')).toBeInTheDocument();
    expect(within(assistantTurn).getByText('Insert lifecycle note')).toBeInTheDocument();
  });
});
