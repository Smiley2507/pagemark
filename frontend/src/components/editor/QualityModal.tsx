import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { sectionsApi } from '@/api/sections';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Link2,
  BookOpen,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { qualityApi } from '@/api/quality';
import type { QualityStatus } from '@/api/quality';
import type { QualityIssue, BrokenLink } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'issues' | 'links' | 'terminology';
type SeverityFilter = 'all' | 'error' | 'warning' | 'info';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-status-success-foreground';
  if (score >= 60) return 'text-status-warning-foreground';
  return 'text-status-danger-foreground';
}

function scoreRing(score: number): string {
  if (score >= 80) return 'stroke-status-success-foreground';
  if (score >= 60) return 'stroke-status-warning-foreground';
  return 'stroke-status-danger-foreground';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-status-success/10';
  if (score >= 60) return 'bg-status-warning/10';
  return 'bg-status-danger/10';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-status-success';
  if (score >= 60) return 'bg-status-warning';
  return 'bg-status-danger';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function isMissingQualityReport(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) {
    return false;
  }

  const detail = error.response.data?.detail;
  return typeof detail === 'string' && detail.includes('No quality report found');
}

/** SVG circular progress ring */
function CircularScore({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={10}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          className="transition-all duration-1000 ease-in-out"
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-4xl font-bold tabular-nums', scoreColor(score))}>
          {Math.round(score)}
        </span>
        <span className="text-xs font-medium text-muted-foreground mt-1">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

/** Sub-score card */
function SubScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <Surface variant="panel" padding="default" className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className={cn('text-lg font-bold tabular-nums', scoreColor(score))}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded bg-panel-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-700', scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </Surface>
  );
}

/** Severity icon */
function SeverityIcon({ severity }: { severity: QualityIssue['severity'] }) {
  if (severity === 'error') return <AlertCircle className="h-4 w-4 text-status-danger-foreground shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-status-warning-foreground shrink-0" />;
  return <Info className="h-4 w-4 text-status-info-foreground shrink-0" />;
}

function SeverityPill({ severity }: { severity: QualityIssue['severity'] }) {
  const variant = severity === 'error' ? 'danger' : severity === 'warning' ? 'warning' : 'info';
  return (
    <Badge variant={variant}>
      <SeverityIcon severity={severity} />
      {severity}
    </Badge>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'issues', label: 'Issues', icon: AlertCircle },
  { id: 'links', label: 'Link Check', icon: Link2 },
  { id: 'terminology', label: 'Terminology', icon: BookOpen },
];

// ── Main component ────────────────────────────────────────────────────────────

export const QualityModal: React.FC<{ open: boolean; onClose: () => void; projectId: number; documentId?: number }> = ({ open, onClose, projectId, documentId }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [progress, setProgress] = useState(0);
  const [runStatus, setRunStatus] = useState<QualityStatus | null>(null);
  const hasDocumentContext = Number.isFinite(documentId) && (documentId ?? 0) > 0;

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['quality-modal', projectId, documentId],
    queryFn: async () => {
      try {
        return await qualityApi.getQuality(projectId, documentId!);
      } catch (queryError) {
        if (isMissingQualityReport(queryError)) {
          return null;
        }
        throw queryError;
      }
    },
    retry: false,
    enabled: open && hasDocumentContext,
  });

  const resolveAllMutation = useMutation({
    mutationFn: async () => {
      for (const issue of terminologyIssues) {
        const matches = [...issue.message.matchAll(/"([^"]+)"\s*\((\d+)×\)/g)];
        const canonical = matches[0];
        const alternates = matches.slice(1);
        for (const [, term] of alternates) {
          await sectionsApi.resolveTerminology(projectId, term, canonical[1]);
        }
      }
    },
    onSuccess: () => {
      toast.success('All terminology issues resolved');
      refetch();
    },
    onError: () => toast.error('Failed to resolve some terminology issues'),
  });

  const runMutation = useMutation({
    mutationFn: () => {
      if (!hasDocumentContext) {
        throw new Error('Quality analysis requires an open Document.');
      }
      return qualityApi.runQuality(projectId, documentId!);
    },
    onSuccess: (run) => {
      const queued: QualityStatus = {
        status: 'queued',
        task_id: run.task_id,
        message: run.message,
      };
      setRunStatus(queued);
      toast.success('Quality analysis started.');
      setProgress(5);
      
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 90) return p;
          return p + Math.random() * 15;
        });
      }, 500);

      const poll = setInterval(async () => {
        try {
          const status = await qualityApi.getStatus(projectId, documentId!, run.task_id);
          setRunStatus(status);
          if (status.status === 'completed') {
            clearInterval(poll);
            clearInterval(interval);
            setProgress(100);
            await refetch();
            toast.success('Quality analysis complete');
            setTimeout(() => {
              setProgress(0);
              setRunStatus(null);
            }, 500);
          } else if (status.status === 'failed' || status.status === 'missing_report') {
            clearInterval(poll);
            clearInterval(interval);
            setProgress(0);
            toast.error(status.error || status.message);
          }
        } catch {
          await refetch();
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(poll);
        clearInterval(interval);
        setProgress(0);
      }, 60000);
    },
    onError: () => toast.error(hasDocumentContext ? 'Failed to start quality analysis' : 'Open a Document to run quality analysis'),
  });

  // Terminology: fetch from dedicated endpoint (must be before early return — hooks rule)
  const { data: terminologies } = useQuery({
    queryKey: ['terminology', projectId],
    queryFn: () => sectionsApi.getTerminologyConflicts(projectId),
    enabled: open && activeTab === 'terminology',
    retry: false,
  });

  if (!open) return null;

  // ── Derived data ────────────────────────────────────────────────
  const issues = report?.issues ?? [];
  const brokenLinks = report?.broken_links ?? [];

  const filteredIssues = severityFilter === 'all'
    ? issues
    : issues.filter(i => i.severity === severityFilter);

  // Also extract from quality issues as fallback
  const terminologyIssues = issues.filter(i =>
    i.message.toLowerCase().includes('inconsistent') || i.message.toLowerCase().includes('terminolog')
  );

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const isRunning = runMutation.isPending || progress > 0;
  const qualityError = error && !isMissingQualityReport(error) ? error : null;

  // ── Render helpers ──────────────────────────────────────────────


  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero score + sub-scores */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Circular score */}
        <Surface variant="panel" padding="lg" className={cn(
          'flex flex-col items-center gap-3',
          scoreBg(report?.overall_score ?? 0),
        )}>
          <CircularScore score={report?.overall_score ?? 0} size={160} />
          <p className="text-sm font-medium text-muted-foreground">Overall Score</p>
          {report && (
            <p className="text-xs text-muted-foreground/70">
              Analysed {formatDistanceToNow(new Date(report.generated_at), { addSuffix: true })}
            </p>
          )}
        </Surface>

        {/* Sub-score grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SubScoreCard label="Completeness" score={report?.completeness ?? 0} />
          <SubScoreCard label="Acceptance" score={report?.acceptance_coverage ?? 0} />
          <SubScoreCard label="Readability" score={report?.readability ?? 0} />
          <SubScoreCard label="Consistency" score={report?.consistency ?? 0} />
          <SubScoreCard label="Accuracy" score={report?.accuracy ?? 0} />
        </div>
      </div>

      {/* Issue summary chips */}
      <div className="flex flex-wrap gap-3">
        <Surface variant="muted" className="flex items-center gap-2 px-3 py-2 border-status-danger-foreground/20 bg-status-danger/5">
          <AlertCircle className="h-4 w-4 text-status-danger-foreground" />
          <span className="text-sm font-medium text-status-danger-foreground">{errorCount} Errors</span>
        </Surface>
        <Surface variant="muted" className="flex items-center gap-2 px-3 py-2 border-status-warning-foreground/20 bg-status-warning/5">
          <AlertTriangle className="h-4 w-4 text-status-warning-foreground" />
          <span className="text-sm font-medium text-status-warning-foreground">{warningCount} Warnings</span>
        </Surface>
        <Surface variant="muted" className="flex items-center gap-2 px-3 py-2 border-status-info-foreground/20 bg-status-info/5">
          <Info className="h-4 w-4 text-status-info-foreground" />
          <span className="text-sm font-medium text-status-info-foreground">{infoCount} Info</span>
        </Surface>
        <Surface variant="muted" className="flex items-center gap-2 px-3 py-2">
          <Link2 className="h-4 w-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-secondary">{brokenLinks.length} Broken Links</span>
        </Surface>
      </div>
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-4">
      {/* Severity filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'error', 'warning', 'info'] as SeverityFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setSeverityFilter(f)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors capitalize',
              severityFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-panel-muted text-text-secondary hover:bg-accent',
            )}
          >
            {f === 'all' ? `All (${issues.length})` : `${f} (${issues.filter(i => i.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Issues list */}
      {filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-status-success-foreground" />
          <p className="text-base font-medium text-foreground">No issues found</p>
          <p className="text-sm text-muted-foreground">
            {severityFilter === 'all' ? 'Your documentation looks great!' : `No ${severityFilter}s detected.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map(issue => (
            <Surface
              key={issue.id}
              variant="panel"
              padding="default"
              className="hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <SeverityIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SeverityPill severity={issue.severity} />
                    {issue.section_ref && (
                      <button
                        onClick={() => navigate(`/projects/${projectId}`)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {issue.section_ref}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{issue.message}</p>
                  {issue.suggestion && (
                    <p className="mt-2 text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 italic">
                      💡 {issue.suggestion}
                    </p>
                  )}
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );

  const renderLinks = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {brokenLinks.length === 0 ? 'No broken links detected.' : `${brokenLinks.length} broken link${brokenLinks.length > 1 ? 's' : ''} found.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', runMutation.isPending && 'animate-spin')} />
          Re-check
        </Button>
      </div>

      {brokenLinks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-status-success-foreground" />
          <p className="text-base font-medium text-foreground">All links are working</p>
          <p className="text-sm text-text-secondary">No broken or unreachable URLs detected in your documentation.</p>
        </div>
      ) : (
        <Surface variant="panel" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-panel-muted">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">URL</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Found In</th>
              </tr>
            </thead>
            <tbody>
              {brokenLinks.map(link => (
                <tr key={link.id} className="border-b border-border/50 last:border-0 hover:bg-panel-muted">
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:underline truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.url}</span>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={
                      link.status_code === undefined || link.status_code === null
                        ? 'neutral'
                        : link.status_code < 400
                          ? 'success'
                          : 'danger'
                    }>
                      {link.status_code ?? 'ERR'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {link.section_ref ? (
                      <button
                        onClick={() => navigate(`/projects/${projectId}`)}
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {link.section_ref}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </div>
  );

  const renderTerminology = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Terminology consistency analysis. Standardising terms improves clarity.
        </p>
        {(terminologies && terminologies.length > 0 || terminologyIssues.length > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => resolveAllMutation.mutate()}
            disabled={resolveAllMutation.isPending}
          >
            {resolveAllMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Resolving…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> Resolve All</>
            )}
          </Button>
        )}
      </div>

      {!terminologies && terminologyIssues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-status-success-foreground" />
          <p className="text-base font-medium text-foreground">Terminology is consistent</p>
          <p className="text-sm text-text-secondary">No conflicting terms detected across your documentation.</p>
        </div>
      ) : terminologies && terminologies.length > 0 ? (
        <div className="space-y-3">
          {terminologies.map((tc, i) => (
            <Surface key={i} variant="panel" padding="lg">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-status-warning-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-2">
                    Conflict: "{tc.term_a}" vs "{tc.term_b}"
                  </p>
                  <p className="text-xs text-text-secondary">
                    {tc.conflicts.length} conflicting {tc.conflicts.length === 1 ? 'occurrence' : 'occurrences'} found.
                  </p>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {terminologyIssues.map(issue => {
            const matches = [...issue.message.matchAll(/"([^"]+)"\s*\((\d+)×\)/g)];
            const canonical = matches[0];
            const alternates = matches.slice(1);

            return (
              <Surface key={issue.id} variant="panel" padding="lg">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-5 w-5 text-status-warning-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {canonical && (
                        <Badge variant="success" className="px-3 py-1 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          "{canonical[1]}"
                          <span className="text-xs opacity-70">×{canonical[2]}</span>
                          <span className="ml-1 text-xs font-semibold opacity-80">Recommended</span>
                        </Badge>
                      )}
                      {alternates.map(([, term, count]) => (
                        <Badge key={term} variant="warning" className="px-3 py-1 text-sm">
                          "{term}"
                          <span className="text-xs opacity-70">×{count}</span>
                        </Badge>
                      ))}
                    </div>
                    {issue.suggestion && (
                      <p className="text-xs text-text-secondary italic">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
      <div className="absolute inset-0 bg-overlay/80 backdrop-blur-sm" onClick={onClose} />
      
      <Surface variant="overlay" className="relative z-10 flex flex-col h-full max-h-screen w-full max-w-5xl overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 flex h-14 items-center justify-between border-b border-border bg-panel px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Quality Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => runMutation.mutate()}
              disabled={isRunning || !hasDocumentContext}
            >
              {isRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {progress > 0 ? `${Math.round(progress)}%` : 'Running…'}</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Run Analysis</>
              )}
            </Button>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5 rotate-180" /> {/* using ArrowLeft rotated as close button or X */}
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="border-b border-border bg-panel-muted">
            <div className="h-1 w-full">
              <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            {runStatus && (
              <div className="px-6 py-2 text-xs text-text-secondary">
                <span className="capitalize">{runStatus.status.replace('_', ' ')}</span>
                <span className="text-text-muted"> · {runStatus.error || runStatus.message}</span>
              </div>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Loading */}
          {(isLoading && !report) && (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading quality report…</p>
            </div>
          )}

          {/* Missing Document context */}
          {(!hasDocumentContext && !isRunning) && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded bg-panel-muted">
                <ShieldCheck className="h-8 w-8 text-text-secondary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Open a Document first</h2>
                <p className="mt-2 text-sm text-text-secondary max-w-sm">
                  Quality analysis runs against one Document at a time.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {(hasDocumentContext && qualityError && !isLoading && !isRunning) && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded bg-panel-muted">
                <AlertCircle className="h-8 w-8 text-status-danger-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Quality report unavailable</h2>
                <p className="mt-2 text-sm text-text-secondary max-w-sm">
                  Run analysis again or retry after the service is available.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {/* No report yet */}
          {(hasDocumentContext && !qualityError && !isLoading && !report && !isRunning) && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded bg-panel-muted">
                <ShieldCheck className="h-8 w-8 text-text-secondary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">No quality report yet</h2>
                <p className="mt-2 text-sm text-text-secondary max-w-sm">
                  Run an analysis to score your documentation on completeness, readability, consistency, and link accuracy.
                </p>
              </div>
              <Button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending || !hasDocumentContext}
              >
                <RefreshCw className="h-4 w-4" /> Run Quality Analysis
              </Button>
            </div>
          )}

          {/* Report loaded */}
          {(!isLoading && report) && (
            <>
              {/* Tab navigation */}
              <div className="flex items-center gap-1 border-b border-border mb-8 sticky top-0 bg-canvas/95 backdrop-blur-sm z-10 pt-2">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  // Badge counts
                  let badge: number | null = null;
                  if (tab.id === 'issues') badge = issues.length;
                  if (tab.id === 'links') badge = brokenLinks.length;
                  if (tab.id === 'terminology') badge = terminologyIssues.length;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {badge !== null && badge > 0 && (
                        <Badge variant={tab.id === 'terminology' ? 'warning' : 'danger'} className="text-xs font-bold">
                          {badge}
                        </Badge>
                      )}
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="quality-tab-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'overview' && renderOverview()}
                  {activeTab === 'issues' && renderIssues()}
                  {activeTab === 'links' && renderLinks()}
                  {activeTab === 'terminology' && renderTerminology()}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </main>
      </Surface>
    </div>
  );
};
