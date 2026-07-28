import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPanel } from '@/components/editor/AiPanel';
import { buildAiPanelChatActionPayload, buildTarget } from '@/lib/ai-panel-types';

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
  AiPanelTranscript: ({ turns }: { turns: { id: string; role: string; kind: string; text: string; workRun?: any }[] }) => (
    <div data-testid="ai-panel-transcript">
      {turns.map((t) => (
        <div key={t.id} data-testid={t.role === 'assistant' ? `ai-turn-assistant-${t.kind}` : 'ai-turn-user'}>
          {t.text}
          {t.workRun?.proposed_changes?.map((change: any) => (
            <div key={change.id} data-testid={`ai-proposed-change-${change.id}`}>{change.title}</div>
          ))}
        </div>
      ))}
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

import { useAiStore } from '@/store/aiStore';

vi.mock('@/api/analysis', () => ({
  analysisApi: {
    getClarification: vi.fn(),
    clarifySection: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAiStore.setState({ turns: [] });
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
  it('normalizes AI panel payloads at the API boundary', () => {
    const target = buildTarget(
      11,
      'Overview',
      { sectionId: 11, from: 2, to: 7, text: 'range' },
    );

    const payload = buildAiPanelChatActionPayload({
      message: 'Refine this',
      mode: 'refine',
      selectedModel: 'gpt-4.1-mini',
      target,
      references: [{ type: 'section', id: 12, label: 'API' }],
      resourceIds: [9],
      cursor: { sectionId: 11, pos: 7 },
    });

    expect(payload.selection?.section_id).toBe(11);
    expect(payload.cursor?.section_id).toBe(11);
    expect(payload.mode).toBe('refine');
    expect(JSON.stringify(payload)).not.toContain('sectionId');
  });

  it('accepts the supported AI modes in normalized payloads', () => {
    const target = buildTarget(null, null, null);
    for (const mode of ['chat', 'generate', 'refine', 'expand', 'auto'] as const) {
      expect(buildAiPanelChatActionPayload({
        message: mode,
        mode,
        selectedModel: null,
        target,
        references: [],
        resourceIds: [],
        cursor: null,
      }).mode).toBe(mode);
    }
  });

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

  it('renders a work-run response with its proposed change card in the assistant turn', async () => {
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

    await waitFor(() => expect(screen.getByTestId('ai-panel-transcript')).toBeInTheDocument());
    const assistantTurn = screen.getByTestId('ai-turn-assistant-work_run');
    expect(within(assistantTurn).getByText('Prepared an insertion for review.')).toBeInTheDocument();
    expect(within(assistantTurn).getByTestId('ai-proposed-change-101')).toHaveTextContent('Insert lifecycle note');
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

  it('does not render the full proposed-change queue in the chat tab', () => {
    renderPanel();

    expect(screen.queryByTestId('ai-review-queue')).not.toBeInTheDocument();
  });
});
