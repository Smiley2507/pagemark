import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Check, ChevronDown, Eye, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useRefineSection, useMessages, useStreamMessage, useThreads, useCreateThread, useSuggestStructure, useUpdateProjectContext } from '@/hooks/useAI';
import { useAiCredentials, useAiProviderModels } from '@/hooks/useAiCredentials';
import { useAiStore } from '@/store/aiStore';
import type { Section } from '@/types';
import { DiffViewer } from './DiffViewer';

import { AiPanelHeader } from './ai/AiPanelHeader';
import { AiPanelEmptyState } from './ai/AiPanelEmptyState';
import { AiPanelMessages } from './ai/AiPanelMessages';
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
  sections: { id: number; heading: string }[];
  onApplyContent: (content: string) => void;
  onInsertAtCursor: (content: string) => void;
  onReplaceSelection: (content: string) => void;
  onAppendToSection: (content: string) => void;
  projectName: string;
  projectContextMd?: string | null;
  onOpenPalette?: () => void;
}

type AiProposalKind = 'rewrite' | 'replace_selection' | 'insert' | 'append';

interface AiProposal {
  kind: AiProposalKind;
  content: string;
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

export function AiPanel({
  projectId,
  documentId,
  activeSectionId,
  activeSectionHeading,
  activeSectionContent,
  activeSectionStatus,
  sections,
  onApplyContent,
  onInsertAtCursor,
  onReplaceSelection,
  onAppendToSection,
  projectName,
  projectContextMd,
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
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [diffPreview, setDiffPreview] = useState<{ original: string; refined: string } | null>(null);
  const [structureSuggestions, setStructureSuggestions] = useState<import('@/api/ai').StructuralSuggestion[] | null>(null);

  const refineSection = useRefineSection();
  const suggestStructure = useSuggestStructure();
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

  const { data: threads } = useThreads(projectId);
  const createThread = useCreateThread(projectId);
  const activeThreadId = threads && threads.length > 0 ? threads[0].id : null;
  const { data: messages = [] } = useMessages(activeThreadId);
  const { sendMessage: streamMessage, isStreaming, streamingContent } = useStreamMessage(activeThreadId);

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

  const parseMentions = useCallback((text: string): { cleanText: string; references: string[] } => {
    const refs: string[] = [];
    const clean = text.replace(/@(\w+)/g, (_match, name) => {
      refs.push(name);
      return `@${name}`;
    });
    return { cleanText: clean, references: refs };
  }, []);

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    const { cleanText, references } = parseMentions(prompt.trim());
    setInputValue('');

    // Collect transient context from store
    const { attachments, removeAttachment } = useAiStore.getState();
    const transientItems = attachments.filter((a) => a.type === 'transient');
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

    if (references.length > 0) {
      messagePayload = `${messagePayload}\n\n(referencing: ${references.join(', ')})`;
    }

    if (activeThreadId) {
      streamMessage(
        messagePayload,
        undefined,
        references,
        selectedModel || activeCredential?.model_id || null,
        activeSectionId,
        temperature,
        maxTokens,
      );
    } else {
      const thread = await createThread.mutateAsync({
        title: activeSectionHeading ? `Chat: ${activeSectionHeading}` : 'Editor chat',
      });
      streamMessage(
        messagePayload,
        undefined,
        references,
        selectedModel || activeCredential?.model_id || null,
        activeSectionId,
        temperature,
        maxTokens,
        thread.id,
      );
    }
  };

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

  const handleAcceptSuggestion = async (suggestion: import('@/api/ai').StructuralSuggestion) => {
    if (!documentId) return;
    try {
      if (suggestion.type === 'rename' && suggestion.section_id && suggestion.suggested_heading) {
        await import('@/api/sections').then((m) =>
          m.sectionsApi.updateSectionTitle(suggestion.section_id!, suggestion.suggested_heading!),
        );
        toast.success(`Renamed to "${suggestion.suggested_heading}"`);
      }
    } catch {
      toast.error('Failed to apply suggestion');
    }
  };

  const handleRejectSuggestion = (index: number) => {
    setStructureSuggestions((prev) => (prev ? prev.filter((_, i) => i !== index) : null));
  };

  const handleApplyAllSuggestions = async () => {
    if (!structureSuggestions || !documentId) return;
    const renameSuggestions = structureSuggestions.filter(
      (s) => s.type === 'rename' && s.section_id && s.suggested_heading,
    );
    try {
      const { sectionsApi } = await import('@/api/sections');
      for (const s of renameSuggestions) {
        await sectionsApi.updateSectionTitle(s.section_id!, s.suggested_heading!);
      }
      toast.success(`Applied ${renameSuggestions.length} change(s)`);
      setStructureSuggestions(null);
    } catch {
      toast.error('Failed to apply all changes');
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
        setDiffPreview({ original: activeSectionContent, refined: data.refined });
      }
    } catch {
      toast.error(`AI ${type} failed`);
    }
  };

  const previewProposal = (kind: AiProposalKind, content: string) => {
    if (!activeSectionId) {
      toast.error('Select a section before preparing an AI edit');
      return;
    }
    setProposal({ kind, content });
  };

  const acceptProposal = () => {
    if (!proposal) return;
    if (proposal.kind === 'rewrite') onApplyContent(proposal.content);
    if (proposal.kind === 'replace_selection') onReplaceSelection(proposal.content);
    if (proposal.kind === 'insert') onInsertAtCursor(proposal.content);
    if (proposal.kind === 'append') onAppendToSection(proposal.content);
    setProposal(null);
  };

  const proposalLabel = proposal?.kind === 'rewrite'
    ? 'Rewrite active section'
    : proposal?.kind === 'replace_selection'
      ? 'Replace selected text'
      : proposal?.kind === 'insert'
        ? 'Insert at cursor'
        : 'Append to active section';

  const hasMessages = messages.length > 0 || isStreaming;

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

        {!hasMessages && !clarification ? (
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
        ) : (
          <AiPanelMessages
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onPreviewRewrite={(content) => previewProposal('rewrite', content)}
            onPreviewReplaceSelection={(content) => previewProposal('replace_selection', content)}
            onPreviewInsert={(content) => previewProposal('insert', content)}
            onPreviewAppend={(content) => previewProposal('append', content)}
          />
        )}

        {proposal && (
          <div className="px-3 py-3">
            <div className="rounded-lg border border-interaction/40 bg-interaction-muted/30">
              <div className="flex items-center justify-between gap-2 border-b border-interaction/20 px-3 py-2">
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">{proposalLabel}</h4>
                  <p className="text-[10px] text-text-muted">Review before changing the document.</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={acceptProposal}>
                    <Check className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setProposal(null)}>
                    <X className="h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
                {proposal.content}
              </pre>
            </div>
          </div>
        )}

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

        {diffPreview && (
          <div className="px-3 py-3">
            <div className="rounded-lg border border-border bg-panel">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h4 className="text-sm font-medium">Review Changes</h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      onApplyContent(diffPreview.refined);
                      setDiffPreview(null);
                    }}
                    className="h-7 gap-1 text-xs"
                  >
                    <Check className="h-3 w-3" />
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDiffPreview(null)}
                    className="h-7 gap-1 text-xs"
                  >
                    <X className="h-3 w-3" />
                    Discard
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-3">
                <DiffViewer
                  oldText={diffPreview.original}
                  newText={diffPreview.refined}
                  viewMode="side-by-side"
                />
              </div>
            </div>
          </div>
        )}

        {hasMessages && !clarification && activeSectionId && (
          <div className="border-t border-separator px-4 py-2">
            <div className="flex flex-wrap gap-1">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleAction(chip.label.toLowerCase() as any)}
                  disabled={isStreaming || isRefining}
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
          isStreaming={isStreaming}
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
