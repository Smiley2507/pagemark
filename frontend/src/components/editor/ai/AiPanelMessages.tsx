import { useRef, useEffect, useState } from 'react';
import { Sparkles, Copy, Check, CheckCheck, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
  onApply?: (content: string) => void;
  onReplace?: (content: string) => void;
  onInsert?: (content: string) => void;
}

function MessageBubble({ message, onApply, onReplace, onInsert }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
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
              {onApply && (
                <button
                  onClick={() => onApply(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Apply
                </button>
              )}
              {onReplace && (
                <button
                  onClick={() => onReplace(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Replace
                </button>
              )}
              {onInsert && (
                <button
                  onClick={() => onInsert(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Insert
                </button>
              )}
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
  onApply?: (content: string) => void;
  onReplace?: (content: string) => void;
  onInsert?: (content: string) => void;
}

export function AiPanelMessages({
  messages,
  isStreaming,
  streamingContent,
  onApply,
  onReplace,
  onInsert,
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
          onApply={msg.role === 'ai' ? onApply : undefined}
          onReplace={msg.role === 'ai' ? onReplace : undefined}
          onInsert={msg.role === 'ai' ? onInsert : undefined}
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
