import React from 'react';
import { Check, AlertCircle, Loader2, FileCode2, GitBranch, Layers, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { AnalysisStatus, AnalysisResults } from '@/types';

interface AnalysisFactsStepProps {
  analysisStatus: AnalysisStatus | null;
  analysisResults?: AnalysisResults | null;
  onContinue: () => void;
  onRetry?: () => void;
}

interface FactDisplayProps {
  title: string;
  icon: React.ElementType;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  summary?: string;
  detail?: React.ReactNode;
}

function FactDisplay({ title, icon: Icon, status, summary, detail }: FactDisplayProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        status === 'done' && 'border-status-success bg-status-success',
        status === 'running' && 'border-status-info bg-status-info',
        status === 'failed' && 'border-status-danger bg-status-danger',
        status === 'pending' && 'border-separator bg-panel-muted',
        status === 'skipped' && 'border-separator bg-panel-muted opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            status === 'done' && 'bg-status-success-foreground/10',
            status === 'running' && 'bg-status-info-foreground/10',
            status === 'failed' && 'bg-status-danger-foreground/10',
            status === 'pending' && 'bg-text-muted/10',
            status === 'skipped' && 'bg-text-muted/10'
          )}
        >
          {status === 'done' && <Check className="h-5 w-5 text-status-success-foreground" />}
          {status === 'running' && <Loader2 className="h-5 w-5 text-status-info-foreground animate-spin" />}
          {status === 'failed' && <AlertCircle className="h-5 w-5 text-status-danger-foreground" />}
          {(status === 'pending' || status === 'skipped') && (
            <Icon className="h-5 w-5 text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-body font-medium text-text-primary">{title}</h4>
            {status === 'skipped' && (
              <span className="text-meta text-text-muted">(Skipped)</span>
            )}
          </div>

          {summary && (
            <p className="text-body text-text-secondary mt-1">{summary}</p>
          )}

          {detail && (
            <div className="mt-2">{detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalysisFactsStep({
  analysisStatus,
  analysisResults,
  onContinue,
  onRetry,
}: AnalysisFactsStepProps) {
  const isComplete = analysisStatus?.status === 'completed';
  const isFailed = analysisStatus?.status === 'failed';
  const isRunning = analysisStatus?.status === 'running' || analysisStatus?.status === 'pending';

  const getStepStatus = (stepName: string): 'pending' | 'running' | 'done' | 'failed' | 'skipped' => {
    const step = analysisStatus?.steps?.find((s) => s.name === stepName);
    if (!step) return 'pending';
    return step.status;
  };

  const hasPartialFailure = analysisStatus?.steps?.some((s) => s.status === 'failed' || s.status === 'skipped');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="space-y-2">
        <h2 className="text-title font-semibold text-text-primary">Repository Analysis</h2>
        <p className="text-body text-text-secondary">
          Analyzing your repository to understand its structure, languages, and complexity. This
          information will help recommend the best documentation template.
        </p>
      </div>

      {isFailed && (
        <Notice variant="danger" title="Analysis Failed">
          {analysisStatus.error_message || 'The analysis could not be completed. Please try again.'}
        </Notice>
      )}

      {hasPartialFailure && isComplete && (
        <Notice variant="warning" title="Partial Analysis">
          Some analysis steps could not be completed, but we have enough information to continue.
          Template recommendations may have reduced confidence.
        </Notice>
      )}

      <div className="space-y-3">
        <FactDisplay
          title="Repository Structure"
          icon={GitBranch}
          status={getStepStatus('Extract file tree')}
          summary={
            analysisResults?.file_tree_json
              ? `Found ${countFiles(analysisResults.file_tree_json)} files`
              : undefined
          }
        />

        <FactDisplay
          title="Languages & Stack"
          icon={FileCode2}
          status={getStepStatus('Detect languages')}
          summary={
            analysisResults?.languages_json
              ? `Primary: ${analysisResults.languages_json.primary.join(', ')}`
              : undefined
          }
          detail={
            analysisResults?.languages_json?.breakdown && (
              <div className="flex flex-wrap gap-2 mt-2">
                {analysisResults.languages_json.breakdown.slice(0, 5).map((lang) => (
                  <span
                    key={lang.language}
                    className="px-2 py-1 rounded-md bg-panel text-meta text-text-primary border border-separator"
                  >
                    {lang.language} ({lang.percent.toFixed(1)}%)
                  </span>
                ))}
              </div>
            )
          }
        />

        <FactDisplay
          title="API Endpoints"
          icon={Layers}
          status={getStepStatus('Extract API endpoints')}
          summary={
            analysisResults?.endpoints_json
              ? `Found ${analysisResults.endpoints_json.count} endpoints`
              : undefined
          }
        />

        <FactDisplay
          title="Complexity Metrics"
          icon={Network}
          status={getStepStatus('Analyze complexity')}
          summary={
            analysisResults?.complexity_json
              ? `${analysisResults.complexity_json.total_files} files, ${analysisResults.complexity_json.total_lines.toLocaleString()} lines`
              : undefined
          }
        />
      </div>

      {isRunning && (
        <div className="flex items-center gap-3 text-body text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {analysisStatus.current_step || 'Analyzing...'}
            {analysisStatus.step_number && analysisStatus.total_steps && (
              <span className="ml-2 text-text-muted">
                ({analysisStatus.step_number} of {analysisStatus.total_steps})
              </span>
            )}
          </span>
        </div>
      )}

      {(isComplete || hasPartialFailure) && (
        <div className="flex gap-3 pt-4">
          <Button onClick={onContinue}>Continue to Template Selection</Button>
        </div>
      )}

      {isFailed && onRetry && (
        <div className="flex gap-3 pt-4">
          <Button onClick={onRetry}>Retry Analysis</Button>
          <Button variant="outline" onClick={onContinue}>
            Continue Without Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

function countFiles(node: { type: string; children?: unknown[] }): number {
  if (node.type === 'file') return 1;
  if (node.type === 'dir' && node.children) {
    return node.children.reduce((sum: number, child: unknown): number => {
      if (typeof child === 'object' && child !== null) {
        return sum + countFiles(child as { type: string; children?: unknown[] });
      }
      return sum;
    }, 0);
  }
  return 0;
}
