import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import type { Section } from '@/types';
import type { AIEditorReference, StructuralSuggestion } from '@/api/ai';
import {
  useAcceptAiProposedChange,
  useAiProposedChanges,
  useCreateAiChatAction,
  useCreateAiWorkRun,
  useRefineSection,
  useRejectAiProposedChange,
  useSuggestStructure,
  useUndoAiWorkRun,
  useUpdateProjectContext,
} from '@/hooks/useAI';
import { useAiCredentials, useAiProviderModels } from '@/hooks/useAiCredentials';
import { useAiStore } from '@/store/aiStore';
import { buildTarget, buildChatActionRequest } from '@/lib/ai-panel-types';
import type { AiTranscriptTurn, AiIssue } from '@/lib/ai-panel-types';

import { AiPanelHeader } from './ai/AiPanelHeader';
import { AiPanelTarget } from './ai/AiPanelTarget';
import { AiPanelTranscript } from './ai/AiPanelTranscript';
import { AiPanelReviewQueue } from './ai/AiPanelReviewQueue';
import { AiPanelClarification } from './ai/AiPanelClarification';
import { AiPanelEmptyState } from './ai/AiPanelEmptyState';
import { AiPanelContextBar } from './ai/AiPanelContextBar';
import { AiPanelComposer } from './ai/AiPanelComposer';
import { AiPanelAttachments } from './ai/AiPanelAttachments';
import { StructuralSuggestions } from './StructuralSuggestions';

interface AiPanelProps {
  projectId: number;
  documentId: number;
  activeSectionId: number | null;
  activeSectionHeading: string | null;
  activeSectionContent: string;
  activeSectionStatus: Section['status'];
  activeSelection?: { sectionId: number; from: number; to: number; text: string } | null;
  activeCursor?: { sectionId: number; pos: number } | null;
  sections: { id: number; heading: string }[];
  projectName: string;
  projectContextMd?: string | null;
  draftPrompt?: string;
  draftPromptId?: number;
  draftPromptAutoSubmit?: boolean;
  draftSelection?: { sectionId: number; from: number; to: number; text: string };
  onDraftPromptConsumed?: () => void;
  onOpenPalette?: () => void;
}

const quickChips = [
  { label: 'Generate', text: 'Generate content for this section from the code analysis' },
  { label: 'Refine', text: 'Refine this section for clarity and completeness' },
  { label: 'Expand', text: 'Expand with more detail and examples' },
  { label: 'Summarise', text: 'Summarise the key points of this section' },
  { label: 'Fix', text: 'Fix any inconsistencies or errors in this section' },
  { label: 'Structure', text: 'Suggest structural improvements (reorder, rename, add)' },
];

export function AiPanel({
  projectId,
  documentId,
  activeSectionId,
  activeSectionHeading,
  activeSectionContent,
  activeSectionStatus,
  activeSelection,
  activeCursor,
  sections,
  projectName,
  projectContextMd,
  draftPrompt,
  draftPromptId,
  draftPromptAutoSubmit,
  draftSelection,
  onDraftPromptConsumed,
  onOpenPalette,
}: AiPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [issues, setIssues] = useState<AiIssue[]>([]);

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextDraft, setContextDraft] = useState(projectContextMd || '');
  const [structureSuggestions, setStructureSuggestions] = useState<StructuralSuggestion[] | null>(null);
  const consumedDraftPromptIdRef = useRef<number | null>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const turns = useAiStore((s) => s.turns);
  const addTurns = useAiStore((s) => s.addTurns);
  const clearTurns = useAiStore((s) => s.clearTurns);
  const refineSection = useRefineSection();
  const suggestStructure = useSuggestStructure();
  const createAiChatAction = useCreateAiChatAction(projectId, documentId);
  const createAiWorkRun = useCreateAiWorkRun(projectId, documentId);
  const acceptAiChange = useAcceptAiProposedChange(projectId, documentId);
  const rejectAiChange = useRejectAiProposedChange(projectId, documentId);
  const undoAiWorkRun = useUndoAiWorkRun(projectId, documentId);
  const { data: proposedChanges = [] } = useAiProposedChanges(projectId, documentId);
  const updateProjectContext = useUpdateProjectContext(projectId);
  const { data: credentialsData, isLoading: credentialsLoading } = useAiCredentials();
  const activeCredential = credentialsData?.credentials.find((credential) => credential.is_active);
  const { data: modelData } = useAiProviderModels(activeCredential?.provider || '', Boolean(activeCredential));
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const activeModelLabel = credentialsLoading
    ? 'Loading provider...'
    : activeCredential
      ? `${activeCredential.provider} / ${selectedModel || activeCredential.model_id}`
      : 'No active AI provider';

  // ── Derived state ──────────────────────────────────────────────────────
  const target = useMemo(
    () => buildTarget(activeSectionId, activeSectionHeading, activeSelection ?? null),
    [activeSectionId, activeSectionHeading, activeSelection],
  );

  const openReviewItems = proposedChanges
    .filter((c) => c.status === 'proposed')
    .map((change) => ({
      id: change.id,
      workRunId: change.work_run_id,
      changeType: change.change_type,
      status: change.status,
      title: change.title,
      rationale: change.rationale ?? null,
      change,
    }));

  const sectionClarificationIssue: AiIssue | null = issues.find(
    (i) => i.kind === 'clarification_section',
  ) ?? null;
  const inlineClarificationIssue: AiIssue | null = issues.find(
    (i) => i.kind === 'clarification',
  ) ?? null;

  // ── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    setContextDraft(projectContextMd || '');
  }, [projectContextMd]);

  useEffect(() => {
    if (activeCredential?.model_id) {
      setSelectedModel(activeCredential.model_id);
    }
  }, [activeCredential?.id, activeCredential?.model_id]);

  useEffect(() => {
    if (activeSectionId && activeSectionStatus === 'NEEDS_INPUT') {
      analysisApi.getClarification(activeSectionId).then((clarification) => {
        if (clarification) {
          setIssues((prev) => [
            ...prev.filter((i) => i.kind !== 'clarification_section'),
            {
              id: `clar-section-${activeSectionId}`,
              kind: 'clarification_section',
              message: clarification.question,
              actionable: true,
              relatedSectionId: activeSectionId,
            },
          ]);
        }
      }).catch(() => {});
    } else {
      setIssues((prev) => prev.filter((i) => i.kind !== 'clarification_section'));
    }
  }, [activeSectionId, activeSectionStatus]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const parseMentions = useCallback(
    (text: string): { cleanText: string; references: AIEditorReference[] } => {
      const refs: AIEditorReference[] = [];
      const clean = text.replace(/@(section|document|source|template):([^@\n]+?)(?=\s|$)/g, (_match, type, label) => {
        const trimmed = String(label).trim();
        const section = type === 'section'
          ? sections.find((item) => item.heading.toLowerCase() === trimmed.toLowerCase())
          : null;
        refs.push({ type, id: section?.id ?? null, label: trimmed });
        return _match;
      });
      return { cleanText: clean, references: refs };
    },
    [sections],
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const sendPrompt = useCallback(async (
    prompt: string,
    selectionOverride?: { sectionId: number; from: number; to: number; text: string },
  ) => {
    if (!prompt.trim()) return;
    const { cleanText, references } = parseMentions(prompt.trim());
    const promptSelection = selectionOverride ?? activeSelection;
    const promptCursor = promptSelection
      ? { sectionId: promptSelection.sectionId, pos: promptSelection.to }
      : activeCursor;
    setInputValue('');

    const userTurn: AiTranscriptTurn = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      text: cleanText,
    };
    addTurns((current) => [...current, userTurn]);

    const { attachments, removeAttachment } = useAiStore.getState();
    const transientItems = attachments.filter((a) => a.type === 'transient');
    const structuredReferences: AIEditorReference[] = [
      ...references,
      ...attachments
        .filter((a) => a.type !== 'transient')
        .map((a) => ({
          type: a.type === 'file' || a.type === 'note' ? 'source' : a.type,
          id: a.referenceId ?? a.resourceId ?? null,
          label: a.label || a.reference || null,
        } satisfies AIEditorReference)),
    ];
    const resourceIds = attachments
      .map((a) => a.resourceId)
      .filter((id): id is number => typeof id === 'number');
    let messagePayload = cleanText;
    if (transientItems.length > 0) {
      const contextBlocks = transientItems
        .map((a) => a.reference || '')
        .filter(Boolean)
        .join('\n\n');
      if (contextBlocks) {
        messagePayload = `Context from selection:\n${contextBlocks}\n\n---\n\n${cleanText}`;
      }
      transientItems.forEach((a) => removeAttachment(a.id));
    }

    const { activeMode } = useAiStore.getState();
    try {
      const request = buildChatActionRequest(
        messagePayload,
        activeMode,
        selectedModel || activeCredential?.model_id || null,
        target,
        structuredReferences,
        resourceIds,
        promptCursor ?? null,
      );
      const response = await createAiChatAction.mutateAsync(request);
      const workRun = response.work_run;

      if (workRun) {
        const msg = response.message || 'AI proposed changes for review.';
        addTurns((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            text: msg,
          },
        ]);
        return;
      }

      if (response.action === 'ask_user' || response.action === 'insufficient_context') {
        const issueId = `clar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setIssues((prev) => [
          ...prev,
          {
            id: issueId,
            kind: 'clarification',
            message: response.message || 'More context is needed.',
            actionable: true,
          },
        ]);
        return;
      }

      if (response.message) {
        addTurns((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            text: response.message,
          },
        ]);
      }
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? (typeof error.response?.data?.detail === 'string'
            ? error.response.data.detail
            : JSON.stringify(error.response?.data?.detail) || error.message || 'AI editor action failed')
        : error instanceof Error ? error.message : 'AI editor action failed';
      addTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          text: detail,
          tone: 'error',
        },
      ]);
      toast.error(detail);
    }
  }, [
    activeCredential?.model_id,
    activeCursor,
    activeSelection,
    createAiChatAction,
    parseMentions,
    selectedModel,
    target,
  ]);

  useEffect(() => {
    if (!draftPrompt) return;
    if (draftPromptId != null) {
      if (consumedDraftPromptIdRef.current === draftPromptId) return;
      consumedDraftPromptIdRef.current = draftPromptId;
    }
    if (draftPromptAutoSubmit) {
      void sendPrompt(draftPrompt, draftSelection);
    } else {
      setInputValue(draftPrompt);
    }
    onDraftPromptConsumed?.();
  }, [draftPrompt, draftPromptAutoSubmit, draftPromptId, draftSelection, onDraftPromptConsumed, sendPrompt]);

  const handleSendMessage = () => { void sendPrompt(inputValue); };

  const handleClarifySection = async (answer: string) => {
    if (!activeSectionId) return;
    try {
      await analysisApi.clarifySection(activeSectionId, answer);
      toast.success('Answer submitted. AI is resuming...');
      setIssues((prev) => prev.filter((i) => i.kind !== 'clarification_section'));
    } catch {
      toast.error('Failed to submit answer');
    }
  };

  const handleSubmitClarification = (answer: string) => {
    const addition = answer.trim();
    const nextContext = [contextDraft.trim(), `## Correction from AI clarification\n\n${addition}`]
      .filter(Boolean)
      .join('\n\n');
    setContextDraft(nextContext);
    updateProjectContext.mutate(nextContext);
    setIssues((prev) => prev.filter((i) => i.kind !== 'clarification'));
  };

  const isRefining = refineSection.isPending;

  const handleSuggestStructure = async () => {
    if (!documentId) return;
    try {
      const suggestions = await suggestStructure.mutateAsync(documentId);
      setStructureSuggestions(suggestions);
    } catch {
      toast.error('Failed to generate structural suggestions');
    }
  };

  const structuralChangePayload = (suggestion: StructuralSuggestion) => {
    if (suggestion.type === 'rename' && suggestion.section_id && suggestion.suggested_heading) {
      return {
        change_type: 'rename_section' as const,
        title: `Rename section to "${suggestion.suggested_heading}"`,
        section_id: suggestion.section_id,
        rationale: suggestion.reasoning,
        before: { heading: suggestion.heading },
        after: { heading: suggestion.suggested_heading },
        preview_markdown: `# ${suggestion.suggested_heading}`,
      };
    }
    if (suggestion.type === 'add' && suggestion.suggested_heading) {
      const content = suggestion.suggested_content_md?.trim() || '';
      return {
        change_type: 'add_section' as const,
        title: `Add section "${suggestion.suggested_heading}"`,
        section_id: null,
        rationale: suggestion.reasoning,
        before: null,
        after: {
          heading: suggestion.suggested_heading,
          content_md: content,
          parent_heading: suggestion.suggested_parent_heading,
          order_index: suggestion.suggested_order ?? sections.length,
        },
        preview_markdown: content || suggestion.reasoning,
      };
    }
    return null;
  };

  const queueStructuralChanges = async (suggestions: StructuralSuggestion[]) => {
    const changes = suggestions.map(structuralChangePayload).filter((change) => change !== null);
    if (changes.length === 0) {
      toast.error('This structural suggestion is not supported for review yet');
      return;
    }
    await createAiWorkRun.mutateAsync({
      provider: activeCredential?.provider || 'structure',
      model: selectedModel || activeCredential?.model_id || 'unspecified',
      prompt_context: {
        project_id: projectId,
        document_id: documentId,
        source: 'structure_suggestions',
      },
      changes,
    });
  };

  const handleAcceptSuggestion = async (suggestion: StructuralSuggestion) => {
    if (!documentId) return;
    try {
      await queueStructuralChanges([suggestion]);
    } catch {
      toast.error('Failed to queue structural suggestion');
    }
  };

  const handleRejectSuggestion = (index: number) => {
    setStructureSuggestions((prev) => (prev ? prev.filter((_, i) => i !== index) : null));
  };

  const handleApplyAllSuggestions = async () => {
    if (!structureSuggestions || !documentId) return;
    try {
      await queueStructuralChanges(structureSuggestions);
      setStructureSuggestions(null);
    } catch {
      toast.error('Failed to queue structural suggestions');
    }
  };

  const queueSectionContentChange = async ({
    title,
    content,
    rationale,
  }: {
    title: string;
    content: string;
    rationale?: string;
  }) => {
    if (!activeSectionId) {
      toast.error('Select a section before preparing an AI edit');
      return;
    }
    await createAiWorkRun.mutateAsync({
      provider: activeCredential?.provider || 'chat',
      model: selectedModel || activeCredential?.model_id || 'unspecified',
      prompt_context: {
        project_id: projectId,
        document_id: documentId,
        section_id: activeSectionId,
        section_heading: activeSectionHeading,
      },
      changes: [
        {
          change_type: 'rewrite_selection',
          title,
          section_id: activeSectionId,
          rationale,
          before: { content_md: activeSectionContent },
          after: { content_md: content },
          preview_markdown: content,
        },
      ],
    });
  };

  const handleAction = async (type: 'generate' | 'refine' | 'expand' | 'structure', instruction?: string) => {
    if (type === 'structure') {
      await handleSuggestStructure();
      return;
    }
    if (!activeSectionId) return;
    try {
      if (type === 'generate') {
        await sendPrompt(
          `Draft content for the active section "${activeSectionHeading || 'Untitled Section'}". Use the project brief, source analysis, and current document context. Return only markdown that can be reviewed before I apply it.`,
        );
      } else {
        const inst = type === 'expand'
          ? 'Expand this section with more detail, examples, and explanations'
          : (instruction || 'Improve the clarity, completeness, and readability');
        const data = await refineSection.mutateAsync({
          sectionId: activeSectionId,
          instruction: inst,
          modelName: selectedModel || activeCredential?.model_id || null,
        });
        if (data.action) {
          const question = data.question || 'More project context is needed before AI can safely refine this section.';
          setIssues((prev) => [
            ...prev,
            {
              id: `clar-refine-${Date.now()}`,
              kind: 'clarification',
              message: question,
              actionable: true,
            },
          ]);
          return;
        }
        await queueSectionContentChange({
          title: type === 'expand' ? 'Expand section' : 'Refine section',
          content: data.refined,
          rationale: inst,
        });
      }
    } catch {
      toast.error(`AI ${type} failed`);
    }
  };

  // ── Derived display state ──────────────────────────────────────────────
  const activeIssue = sectionClarificationIssue || inlineClarificationIssue;
  const hasPanelActivity = turns.length > 0
    || openReviewItems.length > 0
    || issues.length > 0
    || structureSuggestions !== null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AiPanelHeader
        temperature={temperature}
        maxTokens={maxTokens}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
        contextEditorOpen={showContextEditor}
        onToggleContextEditor={() => setShowContextEditor((v) => !v)}
        contextDraft={contextDraft}
        onContextDraftChange={setContextDraft}
        onSaveContext={() => updateProjectContext.mutate(contextDraft.trim() || null)}
        isSavingContext={updateProjectContext.isPending}
      />

      <AiPanelTarget target={target} />

      <div className="flex-1 overflow-y-auto">
        {activeIssue && (
          <AiPanelClarification
            issue={activeIssue}
            onSubmit={
              activeIssue.kind === 'clarification_section'
                ? handleClarifySection
                : handleSubmitClarification
            }
            isSubmitting={
              (activeIssue.kind === 'clarification_section' ? false : updateProjectContext.isPending)
            }
          />
        )}

        <AiPanelTranscript turns={turns} onClear={clearTurns} />

        <AiPanelReviewQueue
          items={openReviewItems}
          onAccept={(changeId) => acceptAiChange.mutate(changeId)}
          onReject={(changeId) => rejectAiChange.mutate(changeId)}
          onUndo={(runId) => undoAiWorkRun.mutate(runId)}
          isAccepting={acceptAiChange.isPending}
          isRejecting={rejectAiChange.isPending}
          isUndoing={undoAiWorkRun.isPending}
        />

        {structureSuggestions !== null && (
          <div className="px-3 py-3">
            <StructuralSuggestions
              suggestions={structureSuggestions}
              onAccept={handleAcceptSuggestion}
              onReject={handleRejectSuggestion}
              onApplyAll={handleApplyAllSuggestions}
              onClose={() => setStructureSuggestions(null)}
              isApplying={suggestStructure.isPending}
            />
          </div>
        )}

        {!hasPanelActivity && !activeIssue ? (
          <AiPanelEmptyState
            onSelectSuggestion={(action) => {
              const chip = quickChips.find((c) => c.text === action);
              if (chip) {
                handleAction(chip.label.toLowerCase() as any);
              } else {
                setInputValue(action);
              }
            }}
          />
        ) : null}

        {hasPanelActivity && !activeIssue && activeSectionId && (
          <div className="border-t border-separator px-4 py-2">
            <div className="flex flex-wrap gap-1">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleAction(chip.label.toLowerCase() as any)}
                  disabled={isRefining}
                  className="rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
              <button
                onClick={() => handleAction('structure')}
                disabled={suggestStructure.isPending}
                className="rounded px-2 py-1 text-[11px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
              >
                {suggestStructure.isPending ? 'Thinking…' : 'Structure'}
              </button>
            </div>
          </div>
        )}
      </div>

      <AiPanelContextBar
        projectId={projectId}
        activeSectionHeading={activeSectionHeading}
        activeSectionStatus={activeSectionStatus}
      />

      {showAttachments && (
        <AiPanelAttachments
          onClose={() => setShowAttachments(false)}
          onOpenPalette={onOpenPalette}
        />
      )}

      <div className="shrink-0 px-3 pb-3 pt-2">
        <AiPanelComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          isStreaming={createAiChatAction.isPending}
          disabled={!activeSectionId}
          activeSectionId={activeSectionId}
          sections={sections}
          onAttachClick={() => setShowAttachments(!showAttachments)}
          activeModelLabel={activeModelLabel}
          hasActiveProvider={Boolean(activeCredential)}
          models={modelData?.models ?? []}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}
