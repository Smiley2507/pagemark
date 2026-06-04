import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowUp,
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useGenerateSection, useRefineSection, useMessages, useStreamMessage, useThreads, useCreateThread } from '@/hooks/useAI';
import type { ChatMessage, Section } from '@/types';

interface RightPanelProps {
  projectId: number;
  documentId: number;
  activeSectionId: number | null;
  activeSectionHeading: string | null;
  activeSectionContent: string;
  activeSectionStatus: Section['status'];
  onDiffReceived: (diff: { original: string; refined: string }) => void;
  onContentAccepted: (content: string) => void;
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
      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded flex items-center justify-center hover:bg-muted"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
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

export function RightPanel({
  projectId,
  activeSectionId,
  activeSectionHeading,
  activeSectionContent,
  activeSectionStatus,
  onDiffReceived,
  isApproved,
}: RightPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [clarification, setClarification] = useState<{ question: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);

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
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const msg = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (activeThreadId) {
      streamMessage(msg);
    } else {
      await createThread.mutateAsync({ firstMessage: msg });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  const handleAction = async (type: 'generate' | 'refine' | 'expand', instruction?: string) => {
    if (!activeSectionId) return;
    try {
      if (type === 'generate') {
        const data = await generateSection.mutateAsync(activeSectionId);
        toast.success('Section generated');
      } else {
        const inst = type === 'expand'
          ? 'Expand this section with more detail, examples, and explanations'
          : (instruction || 'Improve the clarity, completeness, and readability');
        const data = await refineSection.mutateAsync({ sectionId: activeSectionId, instruction: inst });
        onDiffReceived({ original: activeSectionContent, refined: data.refined });
      }
    } catch {
      toast.error(`AI ${type} failed`);
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background">

      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI Assistant</span>
        {activeSectionHeading && (
          <span className="ml-auto truncate text-meta text-muted-foreground max-w-[180px]">
            @{activeSectionHeading}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {clarification && (
          <div className="mx-3 mt-3 rounded-lg border border-warning bg-warning/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{clarification.question}</p>
            </div>
            <textarea
              value={clarificationAnswer}
              onChange={(e) => setClarificationAnswer(e.target.value)}
              placeholder="Provide the missing context..."
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={2}
            />
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={handleClarify}
              disabled={isClarifying || !clarificationAnswer.trim()}
            >
              {isClarifying && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Submit Answer
            </Button>
          </div>
        )}

        {!hasMessages && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">AI Assistant</p>
            <p className="text-meta text-muted-foreground mb-6 max-w-[220px]">
              Ask me anything about your documentation
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setInputValue(chip.text)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="flex flex-col px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex justify-start items-start gap-2 group">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="text-sm text-foreground max-w-[85%]">
                  {streamingContent ? (
                    <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                      {streamingContent}
                    </ReactMarkdown>
                  ) : (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border px-3 pb-3 pt-3 bg-background">
        <div className="rounded-xl border border-border bg-muted/30 focus-within:border-foreground/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI Assistant..."
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
            rows={1}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {quickChips.slice(0, 3).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    if (activeSectionId) handleAction(chip.label.toLowerCase() as any);
                  }}
                  disabled={isGenerating || isRefining}
                  className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              disabled={!inputValue.trim() || isStreaming}
              onClick={handleSendMessage}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5 text-background" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'justify-start group')}>
      {!isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'text-sm max-w-[85%]',
          isUser
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2'
            : 'text-foreground'
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none relative">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
