import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ArrowUp,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Settings,
  ChevronDown,
  FileText,
  Book,
  FileCode,
  Layout,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useGenerateSection, useRefineSection, useMessages, useStreamMessage, useThreads, useCreateThread } from '@/hooks/useAI';
import type { ChatMessage, Section } from '@/types';

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
  { id: 'claude-3-haiku-latest', label: 'Claude 3 Haiku' },
];

type ReferenceKind = 'section' | 'document' | 'source' | 'template';

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
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

const quickChips = [
  { label: 'Generate', text: 'Generate content for this section from the code analysis' },
  { label: 'Refine', text: 'Refine this section for clarity and completeness' },
  { label: 'Expand', text: 'Expand with more detail and examples' },
  { label: 'Summarise', text: 'Summarise the key points of this section' },
  { label: 'Fix', text: 'Fix any inconsistencies or errors in this section' },
];

const REFERENCE_OPTIONS: { kind: ReferenceKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'section', label: 'Section', icon: FileText },
  { kind: 'document', label: 'Document', icon: Book },
  { kind: 'source', label: 'Source', icon: FileCode },
  { kind: 'template', label: 'Template', icon: Layout },
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
}: AiPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [clarification, setClarification] = useState<{ question: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);

  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionKind, setMentionKind] = useState<ReferenceKind>('section');
  const mentionTriggerPos = useRef<number | null>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef(inputValue);

  const generateSection = useGenerateSection(projectId);
  const refineSection = useRefineSection();

  const { data: threads } = useThreads(projectId);
  const createThread = useCreateThread(projectId);
  const activeThreadId = threads && threads.length > 0 ? threads[0].id : null;
  const { data: messages = [] } = useMessages(activeThreadId);
  const { sendMessage: streamMessage, isStreaming, streamingContent } = useStreamMessage(activeThreadId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (activeSectionId && activeSectionStatus === 'NEEDS_INPUT') {
      analysisApi.getClarification(activeSectionId).then(setClarification).catch(() => {});
    } else {
      setClarification(null);
      setClarificationAnswer('');
    }
  }, [activeSectionId, activeSectionStatus]);

  useEffect(() => {
    if (inputValue && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    const handleMousedown = (e: MouseEvent) => {
      const target = e.target as Node;
      const mentionEl = mentionDropdownRef.current;
      const modelEl = modelDropdownRef.current;
      const settingsEl = settingsRef.current;
      if (mentionEl && !mentionEl.contains(target) &&
          modelEl && !modelEl.contains(target) &&
          settingsEl && !settingsEl.contains(target)) {
        setShowMentionDropdown(false);
        setShowModelDropdown(false);
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, []);

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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const messagePayload = references.length > 0
      ? `${cleanText}\n\n(referencing: ${references.join(', ')})`
      : cleanText;

    if (activeThreadId) {
      streamMessage(messagePayload);
    } else {
      await createThread.mutateAsync({ firstMessage: messagePayload });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    inputValueRef.current = val;

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      mentionTriggerPos.current = cursorPos;
      setMentionSearch(atMatch[1].toLowerCase());
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (label: string) => {
    if (mentionTriggerPos.current === null || !textareaRef.current) return;
    const cursorPos = mentionTriggerPos.current;
    const currentVal = inputValueRef.current;
    const textBefore = currentVal.slice(0, cursorPos);
    const textAfter = currentVal.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const referencePrefix = mentionKind === 'section' ? '@section:' :
      mentionKind === 'document' ? '@document:' :
      mentionKind === 'source' ? '@source:' : '@template:';
    const newValue = textBefore.slice(0, atIndex) + `${referencePrefix}${label} ` + textAfter;
    setInputValue(newValue);
    setShowMentionDropdown(false);
    mentionTriggerPos.current = null;
    textareaRef.current.focus();
    const newCursor = atIndex + referencePrefix.length + label.length + 1;
    textareaRef.current.setSelectionRange(newCursor, newCursor);
  };

  const filteredMentions = mentionKind === 'section'
    ? sections.filter((s) => s.heading.toLowerCase().includes(mentionSearch)).slice(0, 8)
    : [];

  const referenceItems = mentionKind === 'section' ? filteredMentions.map((s) => ({ id: s.id.toString(), label: s.heading }))
    : mentionKind === 'document' ? [{ id: 'current', label: 'Current Document' }]
    : mentionKind === 'source' ? [{ id: 'repo', label: 'Repository source' }]
    : [{ id: 'template', label: 'Document template' }];

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

  const handleAction = async (type: 'generate' | 'refine' | 'expand', instruction?: string) => {
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
        onApplyContent(data.refined);
      }
    } catch {
      toast.error(`AI ${type} failed`);
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;
  const currentModelLabel = AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.label || selectedModel;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-separator px-4">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-medium text-text-primary">AI Assistant</span>

        <div className="relative ml-auto flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); setShowSettings(false); }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-panel-muted"
          >
            {currentModelLabel}
            <ChevronDown className="h-3 w-3" />
          </button>

          {showModelDropdown && (
            <div ref={modelDropdownRef} className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-separator bg-panel py-1 shadow-lg">
              {AVAILABLE_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setShowModelDropdown(false); }}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-xs transition-colors',
                    m.id === selectedModel ? 'bg-interaction-muted text-interaction-hover' : 'text-text-muted hover:bg-panel-muted',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowModelDropdown(false); }}
            className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {showSettings && (
            <div ref={settingsRef} className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-separator bg-panel p-3 shadow-lg">
              <div className="mb-2 space-y-1">
                <label className="text-[11px] text-text-muted">Temperature: {temperature.toFixed(2)}</label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-text-muted">Max tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Math.max(100, parseInt(e.target.value) || 2000))}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                  min={100}
                  step={100}
                />
              </div>
            </div>
          )}

          {activeSectionHeading && (
            <span className="max-w-[120px] truncate text-meta text-text-muted">
              @{activeSectionHeading}
            </span>
          )}
        </div>
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

        {!hasMessages && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 rounded-full bg-indigo-500/10 p-3">
              <Sparkles className="h-6 w-6 text-indigo-500" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-primary">AI Assistant</p>
            <p className="mb-6 max-w-[220px] text-meta text-text-muted">
              Ask me anything about your documentation
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setInputValue(chip.text)}
                  className="rounded-full border border-separator bg-canvas px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="flex flex-col space-y-4 px-4 py-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onApply={msg.role === 'ai' ? onApplyContent : undefined}
                onReplace={msg.role === 'ai' && activeSectionId ? (content) => onReplaceContent(content, activeSectionId) : undefined}
                onInsert={msg.role === 'ai' ? onInsertAtCursor : undefined}
              />
            ))}
            {isStreaming && (
              <div className="group flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel-muted">
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                </div>
                <div className="max-w-[85%] text-sm text-text-primary">
                  {streamingContent ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="relative shrink-0 border-t border-separator bg-canvas px-3 pb-3 pt-3">
        <div className="rounded-xl border border-input bg-panel focus-within:border-interaction">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message AI Assistant... (type @ for references)"
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            rows={1}
          />

          {showMentionDropdown && (
            <div ref={mentionDropdownRef} className="border-t border-separator px-2 py-1">
              <div className="mb-1 flex gap-1 border-b border-separator pb-1">
                {REFERENCE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.kind}
                      onClick={(e) => { e.stopPropagation(); setMentionKind(opt.kind); }}
                      className={cn(
                        'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors',
                        mentionKind === opt.kind
                          ? 'bg-interaction-muted text-interaction-hover'
                          : 'text-text-muted hover:text-text-primary',
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {referenceItems.length === 0 ? (
                <p className="px-2 py-1 text-[10px] text-text-muted">
                  {mentionKind === 'section' ? 'No matching sections' :
                   mentionKind === 'document' ? 'Type @document: to reference document context' :
                   mentionKind === 'source' ? 'Type @source: to reference source code' :
                   'Type @template: to reference template context'}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {referenceItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => insertMention(item.label)}
                      className="w-full rounded px-2 py-1 text-left text-xs text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
                    >
                      @{mentionKind}:{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex gap-1 overflow-x-auto">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    if (activeSectionId) handleAction(chip.label.toLowerCase() as any);
                  }}
                  disabled={isGenerating || isRefining}
                  className="whitespace-nowrap rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              disabled={!inputValue.trim() || isStreaming}
              onClick={handleSendMessage}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onApply,
  onReplace,
  onInsert,
}: {
  message: ChatMessage;
  onApply?: (content: string) => void;
  onReplace?: (content: string) => void;
  onInsert?: (content: string) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'group')}>
      {!isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel-muted">
          <Sparkles className="h-3 w-3 text-indigo-500" />
        </div>
      )}
      <div className={cn('max-w-[85%] text-sm', isUser ? 'text-text-primary' : 'text-text-primary')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-interaction-muted px-3 py-2 text-sm text-interaction-hover">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {onApply && onReplace && onInsert && (
              <div className="mt-2 flex gap-1 border-t border-separator pt-2">
                <button
                  onClick={() => onApply(message.content)}
                  className="rounded px-2 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Apply
                </button>
                <button
                  onClick={() => onReplace(message.content)}
                  className="rounded px-2 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Replace
                </button>
                <button
                  onClick={() => onInsert(message.content.substring(0, 200))}
                  className="rounded px-2 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Insert
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {!isUser && <CopyButton text={message.content} />}
    </div>
  );
}
