import { useRef, useEffect, useState } from 'react';
import { Sparkles, Copy, Check, CheckCheck, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
  onPreviewRewrite?: (content: string) => void;
  onPreviewReplaceSelection?: (content: string) => void;
  onPreviewInsert?: (content: string) => void;
  onPreviewAppend?: (content: string) => void;
}

function MessageBubble({
  message,
  onPreviewRewrite,
  onPreviewReplaceSelection,
  onPreviewInsert,
  onPreviewAppend,
}: MessageBubbleProps) {
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
              {onPreviewRewrite && (
                <button
                  onClick={() => onPreviewRewrite(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Rewrite
                </button>
              )}
              {onPreviewReplaceSelection && (
                <button
                  onClick={() => onPreviewReplaceSelection(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Selection
                </button>
              )}
              {onPreviewInsert && (
                <button
                  onClick={() => onPreviewInsert(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Insert
                </button>
              )}
              {onPreviewAppend && (
                <button
                  onClick={() => onPreviewAppend(message.content)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                >
                  Append
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
  onPreviewRewrite?: (content: string) => void;
  onPreviewReplaceSelection?: (content: string) => void;
  onPreviewInsert?: (content: string) => void;
  onPreviewAppend?: (content: string) => void;
}

export function AiPanelMessages({
  messages,
  isStreaming,
  streamingContent,
  onPreviewRewrite,
  onPreviewReplaceSelection,
  onPreviewInsert,
  onPreviewAppend,
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
          onPreviewRewrite={msg.role === 'ai' ? onPreviewRewrite : undefined}
          onPreviewReplaceSelection={msg.role === 'ai' ? onPreviewReplaceSelection : undefined}
          onPreviewInsert={msg.role === 'ai' ? onPreviewInsert : undefined}
          onPreviewAppend={msg.role === 'ai' ? onPreviewAppend : undefined}
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
