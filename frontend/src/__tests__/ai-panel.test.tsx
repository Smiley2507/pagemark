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

vi.mock('@/components/editor/ai/AiPanelTarget', () => ({
  AiPanelTarget: ({ target }: { target: { type: string; sectionHeading: string | null } }) => (
    <div data-testid="ai-target">{target.type}{target.sectionHeading ? `: ${target.sectionHeading}` : ''}</div>
  ),
}));

vi.mock('@/components/editor/ai/AiPanelTranscript', () => ({
  AiPanelTranscript: ({ turns }: { turns: { id: string; role: string; text: string }[] }) => (
    <div data-testid="ai-panel-transcript">
      {turns.map((t) => (
        <div key={t.id} data-testid={`ai-turn-${t.role}`}>{t.text}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/editor/ai/AiPanelReviewQueue', () => ({
  AiPanelReviewQueue: ({ items }: { items: { id: number; title: string }[] }) => (
    <div data-testid="ai-review-queue">
      {items.length > 0 && (
        <div data-testid="review-open">
          {items.map((item: any) => (
            <div key={item.id} data-testid={`ai-proposed-change-${item.id}`}>{item.title}</div>
          ))}
        </div>
      )}
    </div>
  ),
}));

vi.mock('@/components/editor/ai/AiPanelClarification', () => ({
  AiPanelClarification: ({ issue, onSubmit }: { issue: { message: string }; onSubmit: (a: string) => void }) => (
    <div data-testid="ai-clarification">
      <span data-testid="clarification-message">{issue.message}</span>
      <button onClick={() => onSubmit('answer text')}>Submit</button>
    </div>
  ),
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

vi.mock('@/api/analysis', () => ({
  analysisApi: {
    getClarification: vi.fn(),
    clarifySection: vi.fn(),
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

describe('AI panel', () => {
  it('shows the target based on active section', () => {
    renderPanel();
    const target = screen.getByTestId('ai-target');
    expect(target.textContent).toBe('section: Overview');
  });

  it('shows target type "document" when no section is active', () => {
    render(
      <AiPanel
        projectId={1}
        documentId={1}
        activeSectionId={null}
        activeSectionHeading={null}
        activeSectionContent=""
        activeSectionStatus="draft"
        sections={[]}
        projectName="Test"
      />,
    );
    const target = screen.getByTestId('ai-target');
    expect(target.textContent).toBe('document');
  });

  it('renders a casual answer as a chat bubble in the transcript', async () => {
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
  });

  it('renders a work-run response as a transcript message, not embedded changes', async () => {
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

    // The assistant message appears in the transcript
    await waitFor(() => expect(screen.getByTestId('ai-panel-transcript')).toBeInTheDocument());
    expect(screen.getByText('Prepared an insertion for review.')).toBeInTheDocument();

    // No proposed change card inside the transcript (they go to the review queue via React Query)
    expect(screen.queryByTestId('ai-proposed-change-101')).not.toBeInTheDocument();
  });

  it('shows a clarification issue when AI asks for more context', async () => {
    mutateAsync.mockResolvedValueOnce({
      message: 'I need more details about the authentication flow.',
      action: 'ask_user',
      work_run: null,
    });

    renderPanel();

    fireEvent.change(screen.getByLabelText('ai prompt'), { target: { value: 'Refine the auth section' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByTestId('ai-clarification')).toBeInTheDocument());
    expect(screen.getByText('I need more details about the authentication flow.')).toBeInTheDocument();
  });

  it('shows empty state when there is no panel activity', () => {
    // Use a section status that doesn't trigger clarification
    render(
      <AiPanel
        projectId={1}
        documentId={1}
        activeSectionId={null}
        activeSectionHeading={null}
        activeSectionContent=""
        activeSectionStatus="draft"
        sections={[]}
        projectName="Test"
      />,
    );
    expect(screen.getByTestId('ai-empty-state')).toBeInTheDocument();
  });
});
