import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useGenerateSection, useRefineSection, useMessages, useStreamMessage, useThreads, useCreateThread, useSuggestStructure } from '@/hooks/useAI';
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
  onReplaceContent: (content: string, sectionId: number) => void;
  onInsertAtCursor: (content: string) => void;
  isApproved?: boolean;
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
  sections,
  onApplyContent,
  onReplaceContent,
  onInsertAtCursor,
  isApproved,
  onOpenPalette,
}: AiPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [clarification, setClarification] = useState<{ question: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [showAttachments, setShowAttachments] = useState(false);
  const [diffPreview, setDiffPreview] = useState<{ original: string; refined: string } | null>(null);
  const [structureSuggestions, setStructureSuggestions] = useState<import('@/api/ai').StructuralSuggestion[] | null>(null);

  const generateSection = useGenerateSection(projectId);
  const refineSection = useRefineSection();
  const suggestStructure = useSuggestStructure();

  const { data: threads } = useThreads(projectId);
  const createThread = useCreateThread(projectId);
  const activeThreadId = threads && threads.length > 0 ? threads[0].id : null;
  const { data: messages = [] } = useMessages(activeThreadId);
  const { sendMessage: streamMessage, isStreaming, streamingContent } = useStreamMessage(activeThreadId);

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

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const { cleanText, references } = parseMentions(inputValue.trim());
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
      streamMessage(messagePayload);
    } else {
      await createThread.mutateAsync({ firstMessage: messagePayload });
    }
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

  const isGenerating = generateSection.isPending;
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
        await generateSection.mutateAsync(activeSectionId);
        toast.success('Section generated');
      } else {
        const inst = type === 'expand'
          ? 'Expand this section with more detail, examples, and explanations'
          : (instruction || 'Improve the clarity, completeness, and readability');
        const data = await refineSection.mutateAsync({ sectionId: activeSectionId, instruction: inst });
        setDiffPreview({ original: activeSectionContent, refined: data.refined });
      }
    } catch {
      toast.error(`AI ${type} failed`);
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AiPanelHeader
        temperature={temperature}
        maxTokens={maxTokens}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
      />

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
            onApply={(content) => {
              if (activeSectionId) {
                onApplyContent(content);
              }
            }}
            onReplace={(content) => {
              if (activeSectionId) {
                onReplaceContent(content, activeSectionId);
              }
            }}
            onInsert={onInsertAtCursor}
          />
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
                  disabled={isGenerating || isRefining}
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
        />
      </div>
    </div>
  );
}
