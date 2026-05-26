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
  History as HistoryIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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

type TabType = 'Agent' | 'Chat' | 'History';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface VersionEntry {
  id: number;
  author_type: 'ai' | 'user';
  created_at: string;
  summary: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);

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

  const handleAction = async (type: 'generate' | 'refine' | 'expand', instruction?: string) => {
    if (!activeSectionId) return;

    if (type === 'generate') setIsGenerating(true);
    if (type === 'refine') setIsRefining(true);
    if (type === 'expand') setIsExpanding(true);

    try {
      if (type === 'generate') {
        const data = await sectionsApi.generateAI(activeSectionId);
        onContentAccepted(data.content);
      } else {
        const inst = type === 'expand'
          ? "Expand this section with more detail, examples, and explanations"
          : (instruction || "Improve the clarity, completeness, and readability");
        const data = await sectionsApi.refineAI(activeSectionId, inst);
        onDiffReceived({ original: activeSectionContent, refined: data.refined });
      }
    } catch (e) {
      console.error(`AI ${type} failed`, e);
    } finally {
      setIsGenerating(false);
      setIsRefining(false);
      setIsExpanding(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setActiveTab('Chat');
    setIsStreaming(true);

    try {
      // Mock AI response for now as per common pattern, but implementation should call backend
      setTimeout(() => {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `I've received your request about "${userMsg.content}". How can I further help you refine this section?`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setIsStreaming(false);
      }, 1500);
    } catch (e) {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
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

            {/* Action Cards */}
            <div className="space-y-2">
              <button
                disabled={!activeSectionId || isGenerating}
                onClick={() => handleAction('generate')}
                className="w-full text-left bg-card border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
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
                className="w-full text-left bg-card border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
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
                className="w-full text-left bg-card border border-border rounded-lg px-3 py-3 cursor-pointer hover:border-border/80 shadow-sm bg-card/80 transition-all duration-150 flex items-start gap-3 group disabled:opacity-50"
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
                <div className="flex gap-1 pl-1">
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
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
                      {formatDistanceToNow(new Date(v.created_at), { addFirstCanned: true })} ago
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
            onClick={sendMessage}
            className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 disabled:opacity-50 transition-opacity"
          >
            <ArrowUp className="h-3.5 w-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
