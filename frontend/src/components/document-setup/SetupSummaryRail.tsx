import type { ElementType } from 'react';
import { CheckCircle2, FileCode2, FileText, GitBranch, PenSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { DocumentSetupState, DocumentSetupStage } from '@/types/document-setup';

interface SetupSummaryRailProps {
  state: DocumentSetupState;
  isDrawer?: boolean;
}

const stages: Array<{ key: DocumentSetupStage; label: string; icon: ElementType }> = [
  { key: 'source', label: 'Connect source', icon: GitBranch },
  { key: 'analysis', label: 'Progressive Analysis', icon: FileCode2 },
  { key: 'template-selection', label: 'Template recommendation', icon: FileText },
  { key: 'outline-review', label: 'Outline review', icon: PenSquare },
  { key: 'generation-mode', label: 'Generation choice', icon: Sparkles },
  { key: 'editor-ready', label: 'Enter editor', icon: CheckCircle2 },
];

export function SetupSummaryRail({ state, isDrawer = false }: SetupSummaryRailProps) {
  const currentIndex = Math.max(0, stages.findIndex((item) => item.key === state.stage));
  const progress = Math.round(((currentIndex + 1) / stages.length) * 100);

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-5 border-l border-border bg-canvas',
        isDrawer ? 'p-4' : 'w-[22rem] p-5',
      )}
    >
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div>
          <p className="text-meta-sm uppercase tracking-wide text-text-muted">Progress</p>
          <h2 className="mt-1 text-body font-semibold text-text-primary">{stages[currentIndex]?.label}</h2>
        </div>
        <Progress value={progress} label="First-Document journey" />
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const complete = index < currentIndex;
            const current = index === currentIndex;
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full',
                    complete && 'bg-status-success text-status-success-foreground',
                    current && 'bg-interaction text-interaction-foreground',
                    !complete && !current && 'bg-panel-muted text-text-muted',
                  )}
                >
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn('text-meta', current ? 'text-text-primary' : 'text-text-secondary')}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div>
          <p className="text-meta-sm uppercase tracking-wide text-text-muted">Live summary</p>
          <h2 className="mt-1 text-body font-semibold text-text-primary">Confirmed context</h2>
        </div>

        <SummaryBlock
          title="Project"
          value={state.projectName || 'Waiting for source confirmation'}
          badge={state.projectId ? `Project #${state.projectId}` : undefined}
        />

        <SummaryBlock
          title="Source"
          value={state.sourceLabel || 'Not connected yet'}
          hint={state.sourceLimitations?.[0]}
        />

        {state.repoMetadata && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{state.repoMetadata.branch}</Badge>
            {state.repoMetadata.language && <Badge variant="neutral">{state.repoMetadata.language}</Badge>}
            <Badge variant={state.repoMetadata.visibility === 'private' ? 'info' : 'neutral'}>
              {state.repoMetadata.visibility}
            </Badge>
          </div>
        )}

        <SummaryBlock
          title="Analysis"
          value={
            state.sourceType === 'none'
              ? 'Disabled until source is connected'
              : state.analysisComplete
                ? state.analysisPartial
                  ? 'Partial facts preserved'
                  : 'Current Analysis snapshot ready'
                : 'Pending'
          }
          hint={state.analysisUnavailableReason}
        />

        <SummaryBlock
          title="Template"
          value={
            state.customOutline
              ? 'Custom Outline'
              : state.selectedTemplateName || 'No Template confirmed yet'
          }
          hint={
            state.ruleBasedRecommendationCount || state.aiRecommendationCount
              ? `${state.ruleBasedRecommendationCount || 0} rule-based, ${state.aiRecommendationCount || 0} AI-personalized`
              : undefined
          }
        />

        <SummaryBlock
          title="Generation"
          value={
            state.generationMode
              ? state.generationMode === 'manual'
                ? 'Enter editor without generation'
                : state.generationMode === 'on-demand'
                  ? 'Generate Sections on demand'
                  : 'Generate the complete Document'
              : 'Not chosen yet'
          }
        />
      </Surface>

      {state.sourceLimitations && state.sourceLimitations.length > 0 && (
        <Surface variant="muted" padding="lg">
          <h2 className="text-body font-semibold text-text-primary">Current limitations</h2>
          <ul className="mt-3 space-y-2 text-meta text-text-secondary">
            {state.sourceLimitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}

function SummaryBlock({
  title,
  value,
  badge,
  hint,
}: {
  title: string;
  value: string;
  badge?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-meta-sm uppercase tracking-wide text-text-muted">{title}</p>
        {badge && <Badge variant="neutral">{badge}</Badge>}
      </div>
      <p className="text-body text-text-primary">{value}</p>
      {hint && <p className="text-meta text-text-secondary">{hint}</p>}
    </div>
  );
}
