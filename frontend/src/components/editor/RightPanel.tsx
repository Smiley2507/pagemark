import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, History, MessageSquare, Send, Settings2, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DiffViewer } from './DiffViewer';
import type { ChatMessage, Version } from '@/types';
import {
  useRestoreVersion,
  useVersionDiff,
  useVersions,
} from '@/hooks/useSections';
import { useAiCredentials } from '@/hooks/useAiCredentials';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const QUICK_CHIPS = ['Generate section', 'Improve clarity', 'Add examples'];

interface RightPanelProps {
  projectId: number;
  sectionId: number | null;
  onContentRestored?: (content: string) => void;
}

export function RightPanel({ projectId, sectionId, onContentRestored }: RightPanelProps) {
  const navigate = useNavigate();
  const { data: aiCreds } = useAiCredentials();
  const hasActiveAi = aiCreds?.has_active ?? false;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [diffVersionId, setDiffVersionId] = useState<number | null>(null);

  const [docType, setDocType] = useState('api-reference');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('professional');
  const [features, setFeatures] = useState('');
  const [instructions, setInstructions] = useState('');

  const { data: versions } = useVersions(sectionId);
  const { data: diffData } = useVersionDiff(diffVersionId);
  const restoreMutation = useRestoreVersion(projectId);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (!hasActiveAi) return;
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsStreaming(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: 'ai',
          content:
            'AI assistant integration is coming soon. Your message was received and will be processed when the refine API is connected.',
          created_at: new Date().toISOString(),
        },
      ]);
      setIsStreaming(false);
    }, 1200);
  };

  const handleRestore = (version: Version) => {
    if (!window.confirm(`Restore version from ${formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}?`)) {
      return;
    }
    restoreMutation.mutate(version.id, {
      onSuccess: (section) => {
        onContentRestored?.(section.content_md);
      },
    });
  };

  return (
    <>
      <div className="flex h-full flex-col border-l border-border bg-background">
        <Tabs defaultValue="chat" className="flex h-full flex-col">
          <TabsList className="mx-2 mt-2 shrink-0">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Context
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="chat"
            forceMount
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {!hasActiveAi && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
                  <p className="text-meta text-muted-foreground">
                    Add an API key in Settings to use the AI assistant.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => navigate('/dashboard?tab=settings')}
                  >
                    Open AI settings
                  </Button>
                </div>
              )}
              {hasActiveAi && messages.length === 0 && (
                <p className="text-center text-meta text-muted-foreground">
                  Ask the assistant to help write or refine this section.
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-3 py-2 text-body',
                      msg.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm bg-primary text-primary-foreground'
                        : 'rounded-2xl rounded-tl-sm bg-muted text-foreground'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-border p-3">
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={!hasActiveAi}
                    onClick={() => sendMessage(chip)}
                    className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-meta hover:bg-accent disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && hasActiveAi && sendMessage(input)}
                  placeholder={hasActiveAi ? 'Ask AI…' : 'Add API key in Settings'}
                  disabled={!hasActiveAi}
                  className="rounded-full bg-muted"
                />
                <Button
                  size="icon"
                  className="shrink-0 rounded-full"
                  disabled={!hasActiveAi}
                  onClick={() => sendMessage(input)}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="context"
            forceMount
            className="mt-0 flex-1 overflow-y-auto p-4 data-[state=inactive]:hidden"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-type">Doc type</Label>
                <select
                  id="doc-type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body"
                >
                  <option value="api-reference">API Reference</option>
                  <option value="sdk-guide">SDK Guide</option>
                  <option value="user-manual">User Manual</option>
                  <option value="architecture">Architecture</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Target audience</Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Backend developers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <select
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="features">Key features</Label>
                <textarea
                  id="features"
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body"
                  placeholder="List important features to highlight…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Custom instructions</Label>
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body"
                  placeholder="Additional guidance for the AI…"
                />
              </div>
              <Button className="w-full">Save context</Button>
            </div>
          </TabsContent>

          <TabsContent
            value="history"
            forceMount
            className="mt-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden"
          >
            {!sectionId ? (
              <p className="text-meta text-muted-foreground">Select a section to view history.</p>
            ) : !versions?.length ? (
              <p className="text-meta text-muted-foreground">No versions yet.</p>
            ) : (
              <ul className="space-y-3">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start gap-2">
                      {v.author_type === 'ai' ? (
                        <Bot className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-meta-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                        </p>
                        <p className="mt-1 text-meta-sm">
                          <span className="text-emerald-600 dark:text-emerald-400">+{v.added}</span>
                          {' '}
                          <span className="text-destructive">-{v.removed}</span>
                          {' '}
                          <span className="text-amber-600 dark:text-amber-400">~{v.modified}</span>
                        </p>
                        {v.summary && (
                          <p className="mt-1 text-body text-foreground">{v.summary}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDiffVersionId(v.id)}
                          >
                            View diff
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(v)}
                            disabled={restoreMutation.isPending}
                          >
                            Restore
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={diffVersionId !== null} onOpenChange={(o) => !o && setDiffVersionId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Version diff</DialogTitle>
          </DialogHeader>
          {diffData && (
            <div className="h-[60vh]">
              <DiffViewer
                original={diffData.content_old}
                refined={diffData.content_new}
                onAccept={() => setDiffVersionId(null)}
                onReject={() => setDiffVersionId(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
