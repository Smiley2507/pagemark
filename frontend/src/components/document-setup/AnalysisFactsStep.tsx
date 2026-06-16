import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FolderTree,
  Loader2,
  Network,
  Route,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Progress } from '@/components/ui/progress';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { AnalysisResults, AnalysisStatus } from '@/types';

interface AnalysisFactsStepProps {
  analysisStatus: AnalysisStatus | null;
  analysisResults?: AnalysisResults | null;
  projectOverviewDraft?: string;
  overviewQuestions?: string[];
  hasActiveProvider: boolean;
  isGeneratingOverview?: boolean;
  onOverviewChange?: (value: string) => void;
  onGenerateOverview?: () => void;
  onSaveOverviewAndContinue?: () => void;
  onConfigureProvider?: () => void;
  onContinue: () => void;
  onRetry?: () => void;
}

type FactStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

function mapStepStatus(value?: string): FactStatus {
  if (value === 'done') return 'done';
  if (value === 'running') return 'running';
  if (value === 'failed') return 'failed';
  if (value === 'skipped') return 'skipped';
  return 'pending';
}

function FactCard({
  title,
  status,
  summary,
}: {
  title: string;
  status: FactStatus;
  summary: string;
}) {
  const icon =
    status === 'done' ? (
      <CheckCircle2 className="h-4 w-4 text-status-success-foreground" />
    ) : status === 'running' ? (
      <Loader2 className="h-4 w-4 animate-spin text-status-info-foreground" />
    ) : status === 'failed' ? (
      <AlertCircle className="h-4 w-4 text-status-danger-foreground" />
    ) : (
      <div className="h-2.5 w-2.5 rounded-full bg-text-muted" />
    );

  return (
    <Surface
      variant={status === 'failed' ? 'panel' : 'panel'}
      padding="lg"
      className={cn(
        status === 'done' && 'bg-status-success',
        status === 'running' && 'bg-status-info',
        status === 'failed' && 'bg-status-danger',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="text-body font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-meta text-text-secondary">{summary}</p>
        </div>
      </div>
    </Surface>
  );
}

function countFiles(node?: { type: string; children?: unknown[] }): number {
  if (!node) return 0;
  if (node.type === 'file') return 1;
  if (node.type !== 'dir' || !node.children) return 0;
  return node.children.reduce<number>((sum, child) => {
    if (typeof child === 'object' && child !== null) {
      return sum + countFiles(child as { type: string; children?: unknown[] });
    }
    return sum;
  }, 0);
}

export function AnalysisFactsStep({
  analysisStatus,
  analysisResults,
  projectOverviewDraft,
  overviewQuestions = [],
  hasActiveProvider,
  isGeneratingOverview = false,
  onOverviewChange,
  onGenerateOverview,
  onSaveOverviewAndContinue,
  onConfigureProvider,
  onContinue,
  onRetry,
}: AnalysisFactsStepProps) {
  const isComplete = analysisStatus?.status === 'completed';
  const isFailed = analysisStatus?.status === 'failed';
  const isRunning = analysisStatus?.status === 'running' || analysisStatus?.status === 'pending';
  const progress =
    analysisStatus?.total_steps && analysisStatus?.step_number
      ? Math.min(100, Math.round((analysisStatus.step_number / analysisStatus.total_steps) * 100))
      : 8;

  const fileTreeStep = mapStepStatus(
    analysisStatus?.steps?.find((step) => step.name === 'Extract file tree')?.status,
  );
  const languageStep = mapStepStatus(
    analysisStatus?.steps?.find((step) => step.name === 'Detect languages')?.status,
  );
  const endpointStep = mapStepStatus(
    analysisStatus?.steps?.find((step) => step.name === 'Extract API endpoints')?.status,
  );
  const complexityStep = mapStepStatus(
    analysisStatus?.steps?.find((step) => step.name === 'Analyze complexity')?.status,
  );

  const partialFailure =
    isComplete &&
    !!analysisStatus?.steps?.some((step) => step.status === 'failed' || step.status === 'skipped');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-title text-text-primary">Analysis facts</h1>
        <p className="mt-3 text-body text-text-secondary">
          Review what Pagemark found in your source.
        </p>
      </div>

      <Surface variant="panel" padding="lg" className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-body font-semibold text-text-primary">
              {analysisStatus?.current_step || 'Preparing Analysis'}
            </h2>
            <p className="mt-1 text-meta text-text-secondary">
              {analysisStatus?.step_detail || 'Waiting for analysis results…'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-meta-sm uppercase tracking-wide text-text-muted">Progress</div>
            <div className="mt-1 text-body font-semibold text-text-primary">
              {isComplete ? 'Complete' : isFailed ? 'Attention needed' : `${progress}%`}
            </div>
          </div>
        </div>
        <Progress value={progress} />

        {partialFailure && (
          <Notice variant="warning" title="Partial analysis preserved usable facts">
            Some analysis steps did not finish, but available facts remain usable.
          </Notice>
        )}

        {isFailed && (
          <Notice variant="danger" title="Analysis could not complete">
            {analysisStatus?.error_message || 'Analysis failed. You can retry or continue without it.'}
          </Notice>
        )}
      </Surface>

      <div className="grid gap-4 md:grid-cols-2">
        <FactCard
          title="Repository structure"
          status={fileTreeStep}
          summary={
            analysisResults?.file_tree_json
              ? `${countFiles(analysisResults.file_tree_json)} files indexed.`
              : 'Waiting for repository structure data.'
          }
        />
        <FactCard
          title="Languages and stack"
          status={languageStep}
          summary={
            analysisResults?.languages_json?.primary?.length
              ? `Primary languages: ${analysisResults.languages_json.primary.join(', ')}.`
              : 'Detecting languages used in the codebase.'
          }
        />
        <FactCard
          title="API surface"
          status={endpointStep}
          summary={
            analysisResults?.endpoints_json
              ? `${analysisResults.endpoints_json.count} endpoints detected across ${analysisResults.endpoints_json.frameworks.join(', ') || 'the repository'}.`
              : 'Extracting API endpoints from the codebase.'
          }
        />
        <FactCard
          title="Complexity"
          status={complexityStep}
          summary={
            analysisResults?.complexity_json
              ? `${analysisResults.complexity_json.total_files} files and ${analysisResults.complexity_json.total_lines.toLocaleString()} lines analyzed.`
              : 'Computing complexity metrics.'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Surface variant="muted" padding="lg">
          <h2 className="text-body font-semibold text-text-primary">Used for</h2>
          <ul className="mt-3 space-y-2 text-meta text-text-secondary">
            <li>Template recommendations.</li>
            <li>Outline evidence.</li>
            <li>Freshness checks.</li>
          </ul>
        </Surface>
        <Surface variant="muted" padding="lg">
          <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
            <FolderTree className="h-4 w-4 text-interaction" />
            Live categories
          </div>
          <ul className="mt-3 space-y-2 text-meta text-text-secondary">
            <li className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5 text-interaction" /> Languages</li>
            <li className="flex items-center gap-2"><Route className="h-3.5 w-3.5 text-interaction" /> Endpoints</li>
            <li className="flex items-center gap-2"><Network className="h-3.5 w-3.5 text-interaction" /> Complexity</li>
          </ul>
        </Surface>
      </div>

      {isComplete && (
        <Surface variant="panel" padding="lg" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-body font-semibold text-text-primary">Project overview draft</h2>
              <p className="mt-1 text-meta text-text-secondary">
                Turn Analysis facts into a maintainer-approved brief before choosing templates and generating sections.
              </p>
            </div>
            {!projectOverviewDraft && (
              hasActiveProvider ? (
                <Button onClick={onGenerateOverview} disabled={isGeneratingOverview}>
                  {isGeneratingOverview ? 'Creating overview...' : 'Create AI overview'}
                </Button>
              ) : (
                <Button variant="outline" onClick={onConfigureProvider}>
                  Configure provider
                </Button>
              )
            )}
          </div>

          {projectOverviewDraft ? (
            <div className="space-y-3">
              <textarea
                value={projectOverviewDraft}
                onChange={(event) => onOverviewChange?.(event.target.value)}
                rows={12}
                className="w-full resize-y rounded-md border border-input bg-canvas px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {overviewQuestions.length > 0 && (
                <Notice variant="warning" title="Questions to confirm">
                  <ul className="space-y-1">
                    {overviewQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={onSaveOverviewAndContinue}>Save overview and continue</Button>
                <Button variant="outline" onClick={onGenerateOverview} disabled={isGeneratingOverview || !hasActiveProvider}>
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <Notice variant="generation" title="Recommended next step">
              Create and review a Project overview so templates, outlines, and generated drafts share the same corrected context.
            </Notice>
          )}
        </Surface>
      )}

      <div className="flex flex-wrap gap-3">
        {isFailed && onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Retry Analysis
          </Button>
        )}
        {(isComplete || isFailed) && (
          <Button variant={isComplete && !projectOverviewDraft ? 'outline' : 'default'} onClick={onContinue}>
            {isComplete && !projectOverviewDraft ? 'Continue without overview' : 'Continue'}
          </Button>
        )}
        {isRunning && (
          <Button variant="outline" disabled>
            Waiting for facts
          </Button>
        )}
      </div>
    </div>
  );
}
