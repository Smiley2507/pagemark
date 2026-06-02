import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  ArrowsUpFromLine,
  MessageSquare,
  FileText,
  User,
  ArrowUp,
  ChevronRight,
  ChevronLeft,
  History as HistoryIcon,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { sectionsApi } from '@/api/sections';
import { useGenerateSection, useRefineSection, useMessages, useStreamMessage, useThreads, useCreateThread, useUpdateProjectContext } from '@/hooks/useAI';
import { useProject } from '@/hooks/useProject';
import type { ChatMessage, Section } from '@/types';

interface RightPanelProps {
  projectId: number;
  activeSectionId: number | null;
  activeSectionHeading: string | null;
  activeSectionContent: string;
  activeSectionStatus: 'pending' | 'draft' | 'finalized';
  onDiffReceived: (diff: { original: string, refined: string }) => void;
  onContentAccepted: (content: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

type TabType = 'Agent' | 'Chat' | 'Context' | 'History';

interface VersionEntry {
  id: number;
  author_type: 'ai' | 'user';
  created_at: string;
  summary?: string;
  added: number;
  removed: number;
}

export function RightPanel({
  projectId,
  activeSectionId,
  activeSectionHeading,
  activeSectionContent,
  activeSectionStatus,
  onDiffReceived,
  onContentAccepted,
  isOpen,
  onToggle,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('Agent');
  const [inputValue, setInputValue] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [contextForm, setContextForm] = useState('');
  const [clarification, setClarification] = useState<{ question: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);

  const { data: project } = useProject(projectId);
  const updateContext = useUpdateProjectContext(projectId);

  useEffect(() => {
    if (project?.context_md !== undefined) {
      setContextForm(project.context_md || '');
    }
  }, [project?.context_md]);

  useEffect(() => {
    if (activeSectionId && activeSectionStatus === 'NEEDS_INPUT') {
      fetchClarification();
    } else {
      setClarification(null);
      setClarificationAnswer('');
    }
  }, [activeSectionId, activeSectionStatus]);

  const fetchClarification = async () => {
    try {
      const data = await analysisApi.getClarification(activeSectionId!);
      setClarification(data);
    } catch (e) {
      console.error('Failed to fetch clarification', e);
    }
  };

  const generateSection = useGenerateSection(projectId);
  const refineSection = useRefineSection();

  // Chat state
  const { data: threads } = useThreads(projectId);
  const createThread = useCreateThread(projectId);
  
  // Use first thread or none
  const activeThreadId = threads && threads.length > 0 ? threads[0].id : null;
  
  const { data: messages = [] } = useMessages(activeThreadId);
  const { sendMessage: streamMessage, isStreaming, streamingContent } = useStreamMessage(activeThreadId);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (activeSectionId) {
      fetchVersions();
    }
  }, [activeSectionId]);

  const fetchVersions = async () => {
    try {
      const data = await sectionsApi.getVersions(activeSectionId!);
      setVersions(data);
    } catch (e) {
      console.error('Failed to fetch versions', e);
    }
  };

  const handleAutoExpand = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
    setInputValue(target.value);
  };

  const isGenerating = generateSection.isPending;
  const isRefining = refineSection.isPending;

  const handleAction = async (type: 'generate' | 'refine' | 'expand', instruction?: string) => {
    if (!activeSectionId) return;

    if (type === 'expand') setIsExpanding(true);

    try {
      if (type === 'generate') {
        const data = await generateSection.mutateAsync(activeSectionId);
        onContentAccepted(data.content_md);
      } else {
        const inst = type === 'expand'
          ? "Expand this section with more detail, examples, and explanations"
          : (instruction || "Improve the clarity, completeness, and readability");
        const data = await refineSection.mutateAsync({ sectionId: activeSectionId, instruction: inst });
        onDiffReceived({ original: activeSectionContent, refined: data.refined });
      }
    } catch (e) {
      console.error(`AI ${type} failed`, e);
    } finally {
      if (type === 'expand') setIsExpanding(false);
    }
  };

  const handleClarify = async () => {
    if (!activeSectionId || !clarificationAnswer.trim()) return;
    setIsClarifying(true);
    try {
      await analysisApi.clarifySection(activeSectionId, clarificationAnswer.trim());
      toast.success('Answer submitted. AI is resuming generation...');
      setClarification(null);
      setClarificationAnswer('');
    } catch (e) {
      toast.error('Failed to submit answer');
      console.error(e);
    } finally {
      setIsClarifying(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (!activeThreadId) {
      // Create thread if none exists
      const thread = await createThread.mutateAsync({ firstMessage: inputValue.trim() });
      // The query invalidation will fetch the new thread, but for immediate UI:
      // ideally we'd stream directly, but to keep it simple, we can just trigger it
      // though useStreamMessage depends on the hook having the threadId.
      // In this app, we rely on the query to refresh.
      toast.success('Chat started. Please send your message again.');
      return;
    }

    const msg = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setActiveTab('Chat');
    streamMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };


  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    finalized: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 300 : 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        "relative h-full flex-shrink-0 overflow-hidden border-l border-border/50 bg-background flex flex-col",
        !isOpen && "border-none"
      )}
    >
      {/* Collapse Button Mirror */}
      <button
        onClick={onToggle}
        className="absolute -left-4 top-[60px] z-50 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
      >
        <ChevronLeft className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "rotate-180")} />
      </button>

      {/* Tab Strip */}
      <div className="h-12 flex shrink-0 items-center border-b border-border px-3">
        <div className="flex w-full gap-4">
          {(['Agent', 'Chat', 'History'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm cursor-pointer transition-colors relative",
                activeTab === tab
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === 'Agent' && (
          <div className="px-3 py-4 space-y-3">
            {/* Context Pill */}
            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate flex-1">
                {activeSectionHeading || "No section selected"}
              </span>
              {activeSectionId && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider", statusColors[activeSectionStatus])}>
                  {activeSectionStatus}
                </span>
              )}
            </div>

            {clarification && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-200 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm font-medium italic">
                    {clarification.question}
                  </div>
                </div>
                <div className="space-y-2">
                  <textarea
                    value={clarificationAnswer}
                    onChange={(e) => setClarificationAnswer(e.target.value)}
                    placeholder="Provide the missing context..."
                    className="w-full bg-white rounded-md border border-amber-200 px-2 py-1.5 text-sm placeholder:text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-amber-950 dark:border-amber-800"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleClarify}
                    disabled={isClarifying || !clarificationAnswer.trim()}
                  >
                    {isClarifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Submit Answer
                  </Button>
                </div>
              </div>
            )}

            {/* Action Cards */}
            <div className="space-y-2">
              <button
                disabled={!activeSectionId || isGenerating}
                onClick={() => handleAction('generate')}
                className="w-full text-left border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
              >
                <Sparkles className={cn("h-4 w-4 text-violet-500 mt-0.5 transition-transform", isGenerating && "animate-spin")} />
                <div>
                  <div className="text-sm font-medium">{isGenerating ? "Generating..." : "Generate"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Write this section using code analysis</div>
                </div>
              </button>

              <button
                disabled={!activeSectionId || isRefining}
                onClick={() => handleAction('refine')}
                className="w-full text-left border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{isRefining ? "Refining..." : "Refine"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Improve clarity and completeness</div>
                </div>
              </button>

              <button
                disabled={!activeSectionId || isExpanding}
                onClick={() => handleAction('expand')}
                className="w-full text-left border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
              >
                <ArrowsUpFromLine className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{isExpanding ? "Expanding..." : "Expand"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Add more detail and examples</div>
                </div>
              </button>
            </div>

            <Separator className="my-2" />
            <div className="text-xs text-muted-foreground">Or describe what you want:</div>
          </div>
        )}

        {activeTab === 'Chat' && (
          <div className="px-3 py-4 space-y-4 flex flex-col">
            {messages.length === 0 && !isStreaming && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <div className="text-sm text-muted-foreground mt-2">No messages yet</div>
                <div className="text-xs text-muted-foreground/60 mt-1">Ask anything about your documentation</div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start items-start gap-2")}>
                {msg.role === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className={cn(
                  "text-sm max-w-[85%] pl-1",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2"
                    : "text-foreground"
                )}>
                  {msg.role === 'ai' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <div className="text-sm max-w-[85%] pl-1 text-foreground">
                  {streamingContent ? (
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  ) : (
                    <div className="flex gap-1 h-5 items-center">
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {activeTab === 'Context' && (
          <div className="px-3 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Project AI Context</label>
              <textarea
                value={contextForm}
                onChange={(e) => setContextForm(e.target.value)}
                placeholder="E.g. The audience is enterprise developers. The tone should be formal. Avoid using the word 'simply'."
                className="w-full bg-muted rounded-xl border border-border px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none transition-colors h-48"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Add instructions that apply to the whole project. The AI will consider this context when generating or refining any section.
              </p>
            </div>
            <button
              onClick={() => updateContext.mutate(contextForm === '' ? null : contextForm)}
              disabled={updateContext.isPending || contextForm === (project?.context_md || '')}
              className="w-full bg-primary text-primary-foreground text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {updateContext.isPending ? 'Saving...' : 'Save Context'}
            </button>
          </div>
        )}

        {activeTab === 'History' && (
          <div className="px-3 py-4 space-y-2">
            {versions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No history yet</div>
            ) : (
              versions.map(v => (
                <div
                  key={v.id}
                  onClick={() => onDiffReceived({ original: '', refined: '' })} // Simplified for now
                  className="bg-muted/50 rounded-lg px-3 py-3 hover:bg-muted cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    {v.author_type === 'ai' ? <Sparkles className="h-3 w-3 text-violet-500" /> : <User className="h-3 w-3 text-blue-500" />}
                    <span className="text-xs font-medium">{v.author_type === 'ai' ? 'AI' : 'You'}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-sm text-foreground font-medium line-clamp-1 mt-1">
                    {v.summary}
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <div className="text-xs">
                      <span className="text-emerald-600">+{v.added}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-red-500">-{v.removed}</span>
                    </div>
                    <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      View diff →
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border px-3 pt-3 pb-3 bg-background">
        {/* Context Pill Row */}
        <div className="flex items-center gap-1 mb-2">
          <button className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5 hover:bg-muted/80 transition-colors flex items-center gap-1">
            <span className="opacity-70">@</span>
            <span className="truncate max-w-[120px]">
              {activeSectionHeading?.slice(0, 20) || "Section"}
            </span>
          </button>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleAutoExpand}
            onKeyDown={handleKeyDown}
            placeholder="Ask or instruct..."
            className="w-full bg-muted rounded-xl border border-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-border focus idea:outline-none resize-none transition-colors"
            rows={1}
          />
        </div>

        {/* Bottom Row */}
        <div className="flex justify-between items-center mt-2">
          {/* Quick Chips */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {[
              { label: "Generate", text: "Generate content for this section from the code analysis" },
              { label: "Refine", text: "Refine this section for clarity and completeness" },
              { label: "Expand", text: "Expand with more detail and examples" },
              { label: "Summarise", text: "Summarise the key points of this section" },
              { label: "Fix", text: "Fix any inconsistencies or errors in this section" },
            ].map(chip => (
              <button
                key={chip.label}
                onClick={() => setInputValue(chip.text)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-background text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Send Button */}
          <button
            disabled={!inputValue.trim()}
            onClick={handleSendMessage}
            className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 disabled:opacity-50 transition-opacity"
          >
            <ArrowUp className="h-3.5 w-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
