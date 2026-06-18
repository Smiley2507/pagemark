import { useRef, useEffect, useState } from 'react';
import { Sparkles, Copy, Check, CheckCheck, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

function parseContextAction(content: string): { action: string; text: string } | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.action === 'ask_user') {
      return { action: 'Clarification needed', text: parsed.question || 'More context is needed.' };
    }
    if (parsed?.action === 'insufficient_context') {
      return { action: 'Insufficient source context', text: parsed.reason || 'Available context does not support this request.' };
    }
  } catch {
    return null;
  }
  return null;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({
  message,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const contextAction = !isUser ? parseContextAction(message.content) : null;

  return (
    <div className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'group')}>
      {!isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10">
          <Sparkles className="h-3 w-3 text-indigo-500" />
        </div>
      )}
      <div className={cn('max-w-[85%]', isUser ? 'order-1' : 'order-1')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-interaction-muted px-3 py-2 text-sm text-interaction-hover">
            {message.content}
          </div>
        ) : (
          contextAction ? (
            <div className="rounded-lg border border-warning bg-warning/5 px-3 py-2">
              <p className="text-sm font-medium text-text-primary">{contextAction.action}</p>
              <p className="mt-1 text-sm text-text-secondary">{contextAction.text}</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        )}
        <div className={cn(
          'mt-1 flex items-center gap-2',
          isUser ? 'justify-end' : 'justify-start',
        )}>
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            {isUser ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {time}
          </span>
          {!isUser && (
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AiPanelMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
}

export function AiPanelMessages({
  messages,
  isStreaming,
  streamingContent,
}: AiPanelMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
        />
      ))}
      {isStreaming && (
        <div className="group flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10">
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
      <div ref={endRef} />
    </div>
  );
}
