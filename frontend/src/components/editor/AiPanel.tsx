import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AlertCircle, Check, ChevronDown, Eye, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
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
import type { Section } from '@/types';
import { DiffViewer } from './DiffViewer';
import type { AIEditorReference, AIProposedChange, StructuralSuggestion } from '@/api/ai';
import { proposedChangeDiffText, proposedChangePreviewText } from '@/lib/ai-proposed-change-preview';

import { AiPanelHeader } from './ai/AiPanelHeader';
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

interface PanelTranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tone?: 'normal' | 'error';
}

const quickChips = [
  { label: 'Generate', text: 'Generate content for this section from the code analysis' },
  { label: 'Refine', text: 'Refine this section for clarity and completeness' },
  { label: 'Expand', text: 'Expand with more detail and examples' },
  { label: 'Summarise', text: 'Summarise the key points of this section' },
  { label: 'Fix', text: 'Fix any inconsistencies or errors in this section' },
  { label: 'Structure', text: 'Suggest structural improvements (reorder, rename, add)' },
];

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  google: 'Google AI Studio',
  openai: 'OpenAI',
  'opencode-go': 'OpenCode Go',
};

function ProposedChangeCard({
  change,
  onAccept,
  onReject,
  onUndo,
  isAccepting,
  isRejecting,
  isUndoing,
}: {
  change: AIProposedChange;
  onAccept: (changeId: number) => void;
  onReject: (changeId: number) => void;
  onUndo: (runId: number) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isUndoing: boolean;
}) {
  const { beforeText, afterText, isTextChange } = proposedChangeDiffText(change);
  const previewText = proposedChangePreviewText(change);
  const canUndo = change.status === 'accepted';

  return (
    <div className="rounded-lg border border-border bg-panel" data-testid={`ai-proposed-change-${change.id}`}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-text-primary">{change.title}</p>
          <p className="text-[10px] capitalize text-text-muted">{change.change_type.replaceAll('_', ' ')} · {change.status}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {change.status === 'proposed' && (
            <>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onAccept(change.id)} disabled={isAccepting}>
                {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onReject(change.id)} disabled={isRejecting}>
                <X className="h-3 w-3" />
                Reject
              </Button>
            </>
          )}
          {canUndo && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onUndo(change.work_run_id)} disabled={isUndoing}>
              {isUndoing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Undo
            </Button>
          )}
        </div>
      </div>
      {change.rationale && <p className="px-3 pt-2 text-[11px] text-text-secondary">{change.rationale}</p>}
      <div className="max-h-72 overflow-auto p-3">
        {isTextChange ? (
          <DiffViewer
            oldText={beforeText}
            newText={afterText}
            viewMode="unified"
          />
        ) : (
          <pre className="whitespace-pre-wrap rounded bg-canvas p-2 text-[11px] leading-relaxed text-text-secondary">
            {previewText}
          </pre>
        )}
      </div>
    </div>
  );
}

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
  const [inputValue, setInputValue] = useState('');
  const [clarification, setClarification] = useState<{ question: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextDraft, setContextDraft] = useState(projectContextMd || '');
  const [structureSuggestions, setStructureSuggestions] = useState<StructuralSuggestion[] | null>(null);
  const [contextAction, setContextAction] = useState<{ action: 'ask_user' | 'insufficient_context'; question: string } | null>(null);
  const [contextActionAnswer, setContextActionAnswer] = useState('');
  const [showPendingChanges, setShowPendingChanges] = useState(false);
  const [transcript, setTranscript] = useState<PanelTranscriptEntry[]>([]);
  const [returnedWorkRunChanges, setReturnedWorkRunChanges] = useState<AIProposedChange[]>([]);
  const consumedDraftPromptIdRef = useRef<number | null>(null);

  const refineSection = useRefineSection();
  const suggestStructure = useSuggestStructure();
  const createAiChatAction = useCreateAiChatAction(projectId, documentId);
  const createAiWorkRun = useCreateAiWorkRun(projectId, documentId);
  const acceptAiChange = useAcceptAiProposedChange(projectId, documentId);
  const rejectAiChange = useRejectAiProposedChange(projectId, documentId);
  const undoAiWorkRun = useUndoAiWorkRun(projectId, documentId);
  const { data: proposedChanges = [] } = useAiProposedChanges(projectId, documentId);
  const visibleProposedChanges = [
    ...returnedWorkRunChanges.filter((local) => !proposedChanges.some((change) => change.id === local.id)),
    ...proposedChanges,
  ];
  const updateProjectContext = useUpdateProjectContext(projectId);
  const { data: credentialsData, isLoading: credentialsLoading } = useAiCredentials();
  const activeCredential = credentialsData?.credentials.find((credential) => credential.is_active);
  const { data: modelData } = useAiProviderModels(activeCredential?.provider || '', Boolean(activeCredential));
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const activeModelLabel = credentialsLoading
    ? 'Loading provider...'
    : activeCredential
      ? `${PROVIDER_LABELS[activeCredential.provider] || activeCredential.provider} / ${selectedModel || activeCredential.model_id}`
      : 'No active AI provider';

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
      analysisApi.getClarification(activeSectionId).then(setClarification).catch(() => {});
    } else {
      setClarification(null);
      setClarificationAnswer('');
    }
  }, [activeSectionId, activeSectionStatus]);

  const parseMentions = useCallback((text: string): { cleanText: string; references: AIEditorReference[] } => {
    const refs: AIEditorReference[] = [];
    const clean = text.replace(/@(section|document|source|template):([^@\n]+?)(?=\s|$)/g, (match, type, label) => {
      const trimmed = String(label).trim();
      const section = type === 'section'
        ? sections.find((item) => item.heading.toLowerCase() === trimmed.toLowerCase())
        : null;
      refs.push({ type, id: section?.id ?? null, label: trimmed });
      return match;
    });
    return { cleanText: clean, references: refs };
  }, [sections]);

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
    setTranscript((current) => [
      ...current,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        text: cleanText,
      },
    ]);

    // Collect transient context from store
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
      // Clear transient attachments after using them
      transientItems.forEach((a) => removeAttachment(a.id));
    }

    const { activeMode } = useAiStore.getState();
    try {
      const response = await createAiChatAction.mutateAsync({
        message: messagePayload,
        mode: activeMode,
        model_name: selectedModel || activeCredential?.model_id || null,
        target_section_id: activeSectionId,
        selection: promptSelection
          ? {
            section_id: promptSelection.sectionId,
            from: promptSelection.from,
            to: promptSelection.to,
            text: promptSelection.text,
          }
          : null,
        cursor: promptCursor
          ? {
            section_id: promptCursor.sectionId,
            pos: promptCursor.pos,
          }
          : null,
        references: structuredReferences,
        resource_ids: resourceIds,
      });
      if (response.work_run) {
        setReturnedWorkRunChanges((current) => {
          const incoming = response.work_run?.proposed_changes ?? [];
          return [
            ...incoming,
            ...current.filter((local) => !incoming.some((change) => change.id === local.id)),
          ];
        });
        setTranscript((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            text: response.message || 'AI prepared an editor action for review.',
          },
        ]);
        setShowPendingChanges(true);
        return;
      }
      if (response.action === 'ask_user' || response.action === 'insufficient_context') {
        setContextAction({
          action: response.action === 'insufficient_context' ? 'insufficient_context' : 'ask_user',
          question: response.message || 'More context is needed.',
        });
        setTranscript((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            text: response.message || 'More context is needed.',
          },
        ]);
        return;
      }
      if (response.message) {
        setTranscript((current) => [
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
        ? String(error.response?.data?.detail || error.message || 'AI editor action failed')
        : error instanceof Error ? error.message : 'AI editor action failed';
      setTranscript((current) => [
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
    activeSectionId,
    activeSelection,
    createAiChatAction,
    parseMentions,
    selectedModel,
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

  const handleSendMessage = async () => {
    await sendPrompt(inputValue);
  };

  const handleClarify = async () => {
    if (!activeSectionId || !clarificationAnswer.trim()) return;
    setIsClarifying(true);
    try {
      await analysisApi.clarifySection(activeSectionId, clarificationAnswer.trim());
      toast.success('Answer submitted. AI is resuming...');
      setClarification(null);
      setClarificationAnswer('');
    } catch {
      toast.error('Failed to submit answer');
    } finally {
      setIsClarifying(false);
    }
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

  const handleApplyAllSuggestions = async () => {
    if (!structureSuggestions || !documentId) return;
    try {
      await queueStructuralChanges(structureSuggestions);
      setStructureSuggestions(null);
    } catch {
      toast.error('Failed to queue structural suggestions');
    }
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
          setContextAction({
            action: data.action,
            question: data.question || 'More project context is needed before AI can safely refine this section.',
          });
          setContextActionAnswer('');
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

  const hasPanelActivity = transcript.length > 0
    || visibleProposedChanges.length > 0
    || Boolean(contextAction)
    || structureSuggestions !== null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AiPanelHeader
        temperature={temperature}
        maxTokens={maxTokens}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
      />

      <div className="shrink-0 border-b border-separator px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="ai-model-select">AI model</label>
            <select
              id="ai-model-select"
              value={selectedModel || activeCredential?.model_id || ''}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={!activeCredential}
              className="h-8 w-full rounded-md border border-input bg-canvas px-2 text-xs text-text-primary disabled:opacity-60"
              title={activeModelLabel}
            >
              {!activeCredential && <option>No active provider</option>}
              {activeCredential && (
                modelData?.models?.length
                  ? modelData.models.map((model) => (
                    <option key={model.id} value={model.id}>{model.label || model.id}</option>
                  ))
                  : <option value={activeCredential.model_id}>{activeCredential.model_id}</option>
              )}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowContextEditor((value) => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2 text-xs text-text-secondary transition-colors hover:bg-panel-muted hover:text-text-primary"
          >
            <Eye className="h-3.5 w-3.5" />
            Context
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        {showContextEditor && (
          <div className="mt-2 space-y-2 rounded-lg border border-separator bg-canvas p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-text-primary">{projectName} brief</p>
                <p className="text-[10px] text-text-muted">Used by chat, refinement, and generation prompts.</p>
              </div>
              <button
                type="button"
                onClick={() => updateProjectContext.mutate(contextDraft.trim() || null)}
                disabled={updateProjectContext.isPending}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-foreground px-2 text-[11px] text-background disabled:opacity-50"
              >
                {updateProjectContext.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            </div>
            <textarea
              value={contextDraft}
              onChange={(event) => setContextDraft(event.target.value)}
              rows={7}
              placeholder={'Project summary, audience, tone, terminology, architecture notes, ignored or wrong facts...'}
              className="w-full resize-y rounded-md border border-input bg-panel px-2 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {visibleProposedChanges.length > 0 && (
          <div className="border-b border-separator px-3 py-2">
            <button
              type="button"
              onClick={() => setShowPendingChanges((value) => !value)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-panel-muted"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-text-primary">Pending changes</span>
                <span className="block text-[10px] text-text-muted">
                  {visibleProposedChanges.filter((change) => change.status === 'proposed').length} pending · {visibleProposedChanges.length} total
                </span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${showPendingChanges ? 'rotate-180' : ''}`} />
            </button>
            {showPendingChanges && (
              <div className="mt-2 space-y-2">
                {visibleProposedChanges.slice(0, 5).map((change) => (
                  <ProposedChangeCard
                    key={change.id}
                    change={change}
                    onAccept={(changeId) => acceptAiChange.mutate(changeId)}
                    onReject={(changeId) => rejectAiChange.mutate(changeId)}
                    onUndo={(runId) => undoAiWorkRun.mutate(runId)}
                    isAccepting={acceptAiChange.isPending}
                    isRejecting={rejectAiChange.isPending}
                    isUndoing={undoAiWorkRun.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {contextAction && (
          <div className="mx-3 mt-3 space-y-2 rounded-lg border border-warning bg-warning/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">
                  {contextAction.action === 'insufficient_context' ? 'Insufficient source context' : 'Clarification needed'}
                </p>
                <p className="text-sm text-text-secondary">{contextAction.question}</p>
              </div>
            </div>
            <textarea
              value={contextActionAnswer}
              onChange={(e) => setContextActionAnswer(e.target.value)}
              placeholder="Add the missing correction or project fact..."
              className="w-full resize-none rounded border border-input bg-canvas px-2.5 py-1.5 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
            />
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => {
                const addition = contextActionAnswer.trim();
                if (!addition) return;
                const nextContext = [
                  contextDraft.trim(),
                  `## Correction from AI clarification\n\n${addition}`,
                ].filter(Boolean).join('\n\n');
                setContextDraft(nextContext);
                updateProjectContext.mutate(nextContext);
                setContextAction(null);
                setContextActionAnswer('');
              }}
              disabled={updateProjectContext.isPending || !contextActionAnswer.trim()}
            >
              {updateProjectContext.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save to Project Brief
            </Button>
          </div>
        )}

        {clarification && (
          <div className="mx-3 mt-3 space-y-2 rounded-lg border border-warning bg-warning/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-sm text-text-primary">{clarification.question}</p>
            </div>
            <textarea
              value={clarificationAnswer}
              onChange={(e) => setClarificationAnswer(e.target.value)}
              placeholder="Provide the missing context..."
              className="w-full resize-none rounded border border-input bg-canvas px-2.5 py-1.5 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              onClick={handleClarify}
              disabled={isClarifying || !clarificationAnswer.trim()}
            >
              {isClarifying && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Submit Answer
            </Button>
          </div>
        )}

        {transcript.length > 0 && (
          <div className="space-y-2 px-3 py-3" data-testid="ai-panel-transcript">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={[
                    'max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed',
                    entry.role === 'user'
                      ? 'bg-foreground text-background'
                      : entry.tone === 'error'
                        ? 'border border-status-danger-foreground/30 bg-status-danger/10 text-text-primary'
                        : 'border border-border bg-panel text-text-primary',
                  ].join(' ')}
                >
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasPanelActivity && !clarification ? (
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

        {hasPanelActivity && !clarification && activeSectionId && (
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
        />
      </div>
    </div>
  );
}
