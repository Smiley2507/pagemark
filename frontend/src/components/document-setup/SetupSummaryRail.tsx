import React from 'react';
import { Check, GitBranch, FileCode2, FileText, Zap, ChevronRight } from 'lucide-react';
import type { DocumentSetupState, DocumentSetupStage } from '@/types/document-setup';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SetupSummaryRailProps {
  state: DocumentSetupState;
  isDrawer?: boolean;
  onClose?: () => void;
}

const stages: Array<{
  key: DocumentSetupStage;
  label: string;
  icon: React.ElementType;
}> = [
  { key: 'source', label: 'Connect Source', icon: GitBranch },
  { key: 'analysis', label: 'Analyze Repository', icon: FileCode2 },
  { key: 'template-selection', label: 'Choose Template', icon: FileText },
  { key: 'outline-review', label: 'Review Outline', icon: FileText },
  { key: 'generation-mode', label: 'Generation Mode', icon: Zap },
  { key: 'editor-ready', label: 'Ready', icon: Check },
];

export function SetupSummaryRail({ state, isDrawer, onClose }: SetupSummaryRailProps) {
  const currentStageIndex = stages.findIndex((s) => s.key === state.stage);

  return (
    <div
      className={cn(
        'flex flex-col gap-6 bg-panel border-l border-separator',
        isDrawer ? 'p-4' : 'w-80 p-6 h-screen overflow-y-auto'
      )}
    >
      {isDrawer && (
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-text-primary">Setup Progress</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
          Progress
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div
                key={stage.key}
                className={cn(
                  'flex items-start gap-3 rounded-md p-2 transition-colors',
                  isCurrent && 'bg-interaction-muted'
                )}
              >
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                    isComplete && 'bg-status-success text-status-success-foreground',
                    isCurrent && 'bg-interaction text-interaction-foreground',
                    !isComplete && !isCurrent && 'bg-panel-muted text-text-muted'
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-body',
                      isCurrent ? 'font-medium text-text-primary' : 'text-text-secondary'
                    )}
                  >
                    {stage.label}
                  </div>
                </div>

                {isCurrent && (
                  <ChevronRight className="h-4 w-4 text-interaction shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {state.repoMetadata && (
        <div className="flex flex-col gap-3 pt-4 border-t border-separator">
          <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
            Source
          </div>
          <div className="space-y-2">
            <div className="text-body text-text-primary font-medium break-words">
              {state.repoMetadata.fullName}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="neutral" className="text-meta">
                {state.repoMetadata.branch}
              </Badge>
              {state.repoMetadata.visibility && (
                <Badge
                  variant={state.repoMetadata.visibility === 'private' ? 'info' : 'neutral'}
                  className="text-meta"
                >
                  {state.repoMetadata.visibility}
                </Badge>
              )}
              {state.repoMetadata.language && (
                <Badge variant="neutral" className="text-meta">
                  {state.repoMetadata.language}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {state.projectName && (
        <div className="flex flex-col gap-3 pt-4 border-t border-separator">
          <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
            Project
          </div>
          <div className="text-body text-text-primary font-medium break-words">
            {state.projectName}
          </div>
        </div>
      )}

      {state.analysisComplete && (
        <div className="flex flex-col gap-3 pt-4 border-t border-separator">
          <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
            Analysis
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-status-success-foreground" />
            <span className="text-body text-text-primary">
              {state.analysisPartial ? 'Partially Complete' : 'Complete'}
            </span>
          </div>
        </div>
      )}

      {state.selectedTemplateId && (
        <div className="flex flex-col gap-3 pt-4 border-t border-separator">
          <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
            Template
          </div>
          <div className="text-body text-text-primary">Selected</div>
        </div>
      )}

      {state.generationMode && (
        <div className="flex flex-col gap-3 pt-4 border-t border-separator">
          <div className="text-meta font-medium text-text-secondary uppercase tracking-wide">
            Generation
          </div>
          <div className="text-body text-text-primary capitalize">
            {state.generationMode === 'on-demand' ? 'On Demand' : 'Complete Document'}
          </div>
        </div>
      )}
    </div>
  );
}
