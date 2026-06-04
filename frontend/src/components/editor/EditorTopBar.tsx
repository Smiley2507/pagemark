import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Sparkles,
  ShieldCheck,
  Download,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserBadge } from '@/components/ui/user-badge';
import { projectsApi } from '@/api/projects';
import { cn } from '@/lib/utils';

type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PENDING';
type ProjectStatus = 'pending' | 'draft' | 'finalized';

interface OverflowAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface EditorTopBarProps {
  projectId: number;
  projectName: string;
  completionPct: number;
  docStatus: DocumentStatus;
  projectStatus: ProjectStatus;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onGenerateAI: () => void;
  onQualityClick: () => void;
  onGrammarCheck: () => void;
  isGenerating: boolean;
  grammarChecking?: boolean;
  notesCount?: number;
  overflowActions?: OverflowAction[];
  userName?: string;
  qualityScore?: number | null;
  issueCount?: number;
}

function CompletionRing({
  pct,
  qualityScore,
  issueCount,
}: {
  pct: number;
  qualityScore?: number | null;
  issueCount?: number;
}) {
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? 'stroke-success' : pct >= 40 ? 'stroke-warning' : 'stroke-destructive';
  const [showHealth, setShowHealth] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (healthRef.current && !healthRef.current.contains(e.target as Node))
        setShowHealth(false);
    };
    if (showHealth) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHealth]);

  return (
    <div ref={healthRef} className="relative">
      <button
        onClick={() => setShowHealth(!showHealth)}
        className="relative flex items-center justify-center cursor-pointer"
      >
        <svg width="34" height="34" className="-rotate-90">
          <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
          <circle
            cx="17" cy="17" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
            className={cn('transition-all duration-500', color)}
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-[10px] font-mono font-medium text-muted-foreground">
          {Math.round(pct)}
        </span>
      </button>

      {showHealth && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
          <h4 className="text-xs font-semibold text-foreground mb-3">Document Health</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sections complete</span>
              <span className="font-medium">{Math.round(pct)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Quality score</span>
              <span
                className={cn(
                  'font-medium',
                  qualityScore != null && (qualityScore >= 80 ? 'text-success' : qualityScore >= 60 ? 'text-warning' : 'text-destructive'),
                )}
              >
                {qualityScore != null ? `${Math.round(qualityScore)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Issues</span>
              <span className={cn('font-medium', (issueCount ?? 0) > 0 ? 'text-warning' : 'text-muted-foreground')}>
                {issueCount ?? '—'}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              Grammar & spelling checks coming soon
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: ProjectStatus;
  onChange: (v: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statuses: { value: ProjectStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground' },
    { value: 'draft', label: 'Draft', color: 'bg-warning text-warning-foreground' },
    { value: 'finalized', label: 'Finalized', color: 'bg-success text-success-foreground' },
  ];

  const current = statuses.find((s) => s.value === value) ?? statuses[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          current.color
        )}
      >
        {current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-border bg-card py-1 shadow-lg">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent',
                s.value === value && 'font-medium'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', s.color.split(' ')[0])} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorTopBar({
  projectId,
  projectName,
  completionPct,
  docStatus,
  projectStatus,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onGenerateAI,
  onQualityClick,
  onGrammarCheck,
  isGenerating,
  grammarChecking,
  notesCount = 0,
  qualityScore,
  issueCount,
  overflowActions,
  userName,
}: EditorTopBarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(projectName);
  }, [projectName]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; status?: ProjectStatus }) =>
      projectsApi.updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const handleNameSubmit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== projectName) {
      updateMutation.mutate({ name: trimmed });
    } else {
      setNameDraft(projectName);
    }
    setEditing(false);
  };

  const handleStatusChange = (status: ProjectStatus) => {
    updateMutation.mutate({ status });
  };

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node))
        setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setOverflowOpen(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {editing ? (
          <input
            ref={inputRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setNameDraft(projectName);
                setEditing(false);
              }
            }}
            className="h-7 rounded border border-border bg-background px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[120px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="truncate max-w-[200px] text-sm font-medium text-foreground hover:text-primary transition-colors rounded px-1 -ml-1 hover:bg-accent/50"
            title="Click to rename"
          >
            {projectName}
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        <CompletionRing pct={completionPct} qualityScore={qualityScore} issueCount={issueCount} />

        <div className="w-px h-4 bg-border mx-1" />

        <StatusDropdown value={projectStatus} onChange={handleStatusChange} />

        <div className="w-px h-4 bg-border mx-1" />

        {docStatus !== 'APPROVED' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={onGenerateAI}
              disabled={isGenerating}
            >
              <Sparkles className={cn('h-3.5 w-3.5', isGenerating && 'animate-pulse')} />
              <span className="text-xs">AI</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={onQualityClick}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-xs">Quality</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={onGrammarCheck}
              disabled={grammarChecking}
            >
              <span className={cn('text-xs', grammarChecking && 'animate-pulse')}>
                {grammarChecking ? 'Checking...' : 'Spelling'}
              </span>
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 relative"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="text-xs">Notes</span>
          {notesCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[14px] rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center px-1">
              {notesCount}
            </span>
          )}
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Overflow menu */}
        <div ref={overflowRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOverflowOpen(!overflowOpen)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {overflowOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
              <button
                onClick={() => {
                  setOverflowOpen(false);
                  navigate(`/export/${projectId}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                <span className="text-xs">Copy link</span>
              </button>
              {overflowActions?.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setOverflowOpen(false);
                    action.onClick();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleLeft}
          aria-label="Toggle left panel"
          data-active={leftOpen}
          className="data-[active=true]:text-primary"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRight}
          aria-label="Toggle right panel"
          data-active={rightOpen}
          className="data-[active=true]:text-primary"
        >
          <PanelRight className="h-4 w-4" />
        </Button>

        <div className="ml-2">
          <UserBadge name={userName} size="sm" />
        </div>
      </div>
    </header>
  );
}
