import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Brain, FileText, Lightbulb, Puzzle, Loader2 } from 'lucide-react';
import { analysisApi } from '@/api/analysis';
import type { NLPReport } from '@/types';
import { cn } from '@/lib/utils';

function useNLPReport(projectId: number) {
  return useQuery<NLPReport>({
    queryKey: ['nlp-report', projectId],
    queryFn: () => analysisApi.getNLPReport(projectId),
    enabled: !!projectId,
  });
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Very Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 50) return 'Plain English';
  if (score >= 30) return 'Fairly Difficult';
  if (score >= 10) return 'Difficult';
  return 'Very Confusing';
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-rose-500';
}

export function NLPDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);

  const { data: report, isLoading, isError } = useNLPReport(pid);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl text-center py-16">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No NLP data available</h2>
          <p className="text-meta text-muted-foreground mb-6">
            Run an analysis on this project to generate readability scores and style insights.
          </p>
          <Link to={`/analysis/${pid}`} className="text-primary hover:underline text-sm">
            Go to Analysis
          </Link>
        </div>
      </div>
    );
  }

  const style = report.style_analysis || {};
  const entities = report.entities || [];
  const suggestions = report.suggestions || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-6">
          <Link
            to={`/analysis/${pid}`}
            className="flex items-center gap-2 text-meta text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-section font-semibold">NLP Dashboard</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Readability Score */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-section font-semibold">Readability</h2>
          </div>
          <div className="flex items-end gap-6">
            <div className="relative h-28 w-28">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
                  stroke={report.readability_score >= 70 ? '#10b981' : report.readability_score >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={`${(report.readability_score / 100) * 97} 97`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums">
                {Math.round(report.readability_score)}
              </span>
            </div>
            <div>
              <p className={cn('text-lg font-bold', scoreColor(report.readability_score))}>
                {scoreLabel(report.readability_score)}
              </p>
              <p className="text-meta text-muted-foreground">
                Flesch Reading Ease score — higher is easier to read
              </p>
            </div>
          </div>
        </section>

        {/* Style Analysis */}
        {Object.keys(style).length > 0 && (
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h2 className="text-section font-semibold">Style Analysis</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(style).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detected Entities */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Puzzle className="h-5 w-5 text-primary" />
            <h2 className="text-section font-semibold">Technical Entities</h2>
          </div>
          {entities.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Entity</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entities.map((e: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{e.name || e}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-meta text-muted-foreground">No entities detected</p>
          )}
        </section>

        {/* Suggestions */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-section font-semibold">Suggestions</h2>
          </div>
          {suggestions.length > 0 ? (
            <ul className="space-y-2">
              {suggestions.map((s: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{typeof s === 'string' ? s : s.message || s.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-meta text-muted-foreground">No suggestions available</p>
          )}
        </section>
      </main>
    </div>
  );
}
