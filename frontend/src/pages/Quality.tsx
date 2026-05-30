import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { qualityApi } from '@/api/quality';
import type { QualityIssue, BrokenLink } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'issues' | 'links' | 'terminology';
type SeverityFilter = 'all' | 'error' | 'warning' | 'info';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreRing(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5';
  if (score >= 60) return 'from-amber-500/20 to-amber-500/5';
  return 'from-red-500/20 to-red-500/5';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
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
          className={scoreRing(score)}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
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
    <div className="flex-1 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('text-lg font-bold tabular-nums', scoreColor(score))}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/** Severity icon */
function SeverityIcon({ severity }: { severity: QualityIssue['severity'] }) {
  if (severity === 'error') return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function SeverityPill({ severity }: { severity: QualityIssue['severity'] }) {
  const cfg = {
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', cfg[severity])}>
      <SeverityIcon severity={severity} />
      {severity}
    </span>
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

export const Quality: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['quality', projectId],
    queryFn: () => qualityApi.getQuality(projectId),
    retry: false,
  });

  const runMutation = useMutation({
    mutationFn: () => qualityApi.runQuality(projectId),
    onSuccess: () => {
      toast.success('Quality analysis started. Results will appear shortly.');
      // Poll for results after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['quality', projectId] });
      }, 4000);
    },
    onError: () => toast.error('Failed to start quality analysis'),
  });

  // ── Derived data ────────────────────────────────────────────────
  const issues = report?.issues ?? [];
  const brokenLinks = report?.broken_links ?? [];

  const filteredIssues = severityFilter === 'all'
    ? issues
    : issues.filter(i => i.severity === severityFilter);

  // Terminology: extract consistency issues (those without section_ref that contain "Inconsistent terminology")
  const terminologyIssues = issues.filter(i =>
    i.message.toLowerCase().includes('inconsistent') || i.message.toLowerCase().includes('terminolog')
  );

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // ── Render helpers ──────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero score + sub-scores */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Circular score */}
        <div className={cn(
          'flex flex-col items-center gap-3 rounded-2xl border border-border bg-gradient-to-br p-8',
          scoreBg(report?.overall_score ?? 0),
        )}>
          <CircularScore score={report?.overall_score ?? 0} size={160} />
          <p className="text-sm font-medium text-muted-foreground">Overall Score</p>
          {report && (
            <p className="text-xs text-muted-foreground/70">
              Analysed {formatDistanceToNow(new Date(report.generated_at), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Sub-score grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SubScoreCard label="Completeness" score={report?.completeness ?? 0} />
          <SubScoreCard label="Readability" score={report?.readability ?? 0} />
          <SubScoreCard label="Consistency" score={report?.consistency ?? 0} />
          <SubScoreCard label="Accuracy" score={report?.accuracy ?? 0} />
        </div>
      </div>

      {/* Issue summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-500">{errorCount} Errors</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-500">{warningCount} Warnings</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <Info className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-500">{infoCount} Info</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{brokenLinks.length} Broken Links</span>
        </div>
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
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize',
              severityFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {f === 'all' ? `All (${issues.length})` : `${f} (${issues.filter(i => i.severity === f).length})`}
          </button>
        ))}
      </div>

      {/* Issues list */}
      {filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-medium text-foreground">No issues found</p>
          <p className="text-sm text-muted-foreground">
            {severityFilter === 'all' ? 'Your documentation looks great!' : `No ${severityFilter}s detected.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map(issue => (
            <div
              key={issue.id}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <SeverityIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SeverityPill severity={issue.severity} />
                    {issue.section_ref && (
                      <button
                        onClick={() => navigate(`/editor/${projectId}`)}
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
            </div>
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
        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', runMutation.isPending && 'animate-spin')} />
          Re-check
        </button>
      </div>

      {brokenLinks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-medium text-foreground">All links are working</p>
          <p className="text-sm text-muted-foreground">No broken or unreachable URLs detected in your documentation.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">URL</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Found In</th>
              </tr>
            </thead>
            <tbody>
              {brokenLinks.map(link => (
                <tr key={link.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
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
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-mono font-medium',
                      link.status_code === undefined || link.status_code === null
                        ? 'bg-muted text-muted-foreground'
                        : link.status_code < 400
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-600',
                    )}>
                      {link.status_code ?? 'ERR'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {link.section_ref ? (
                      <button
                        onClick={() => navigate(`/editor/${projectId}`)}
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
        </div>
      )}
    </div>
  );

  const renderTerminology = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Inconsistent terminology detected across sections. Standardising terms improves clarity.
      </p>

      {terminologyIssues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-medium text-foreground">Terminology is consistent</p>
          <p className="text-sm text-muted-foreground">No conflicting terms detected across your documentation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {terminologyIssues.map(issue => {
            // Parse terms from issue message e.g. '"endpoint" (5×) and "route" (2×) ...'
            const matches = [...issue.message.matchAll(/"([^"]+)"\s*\((\d+)×\)/g)];
            const canonical = matches[0];
            const alternates = matches.slice(1);

            return (
              <div key={issue.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {canonical && (
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          "{canonical[1]}"
                          <span className="text-xs text-emerald-600/70">×{canonical[2]}</span>
                          <span className="ml-1 text-xs text-emerald-700 font-semibold">Recommended</span>
                        </span>
                      )}
                      {alternates.map(([, term, count]) => (
                        <span key={term} className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-700">
                          "{term}"
                          <span className="text-xs text-amber-600/70">×{count}</span>
                        </span>
                      ))}
                    </div>
                    {issue.suggestion && (
                      <p className="text-xs text-muted-foreground italic">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Page layout ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Quality Dashboard</span>
          </div>
        </div>

        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
        >
          {runMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><RefreshCw className="h-4 w-4" /> Run Analysis</>
          )}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading quality report…</p>
          </div>
        )}

        {/* No report yet */}
        {!isLoading && (error || !report) && (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">No quality report yet</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Run an analysis to score your documentation on completeness, readability, consistency, and link accuracy.
              </p>
            </div>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {runMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Run Quality Analysis</>
              )}
            </button>
          </div>
        )}

        {/* Report loaded */}
        {!isLoading && report && (
          <>
            {/* Tab navigation */}
            <div className="flex items-center gap-1 border-b border-border mb-8">
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
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs font-bold',
                        tab.id === 'issues' && errorCount > 0 ? 'bg-red-500 text-white' :
                        tab.id === 'links' ? 'bg-red-500 text-white' :
                        'bg-amber-500 text-white',
                      )}>
                        {badge}
                      </span>
                    )}
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="quality-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
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
    </div>
  );
};
