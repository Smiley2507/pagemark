import React, { useState } from 'react';
import { Zap, Clock, DollarSign, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GenerationEstimate } from '@/types/document-setup';

interface GenerationChoiceStepProps {
  onDemandEstimate: GenerationEstimate;
  completeEstimate: GenerationEstimate;
  onChoose: (mode: 'on-demand' | 'complete') => void;
  hasActiveProvider: boolean;
  onConfigureProvider?: () => void;
}

export function GenerationChoiceStep({
  onDemandEstimate,
  completeEstimate,
  onChoose,
  hasActiveProvider,
  onConfigureProvider,
}: GenerationChoiceStepProps) {
  const [selectedMode, setSelectedMode] = useState<'on-demand' | 'complete' | null>('on-demand');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const estimate = selectedMode === 'on-demand' ? onDemandEstimate : completeEstimate;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="space-y-2">
        <h2 className="text-title font-semibold text-text-primary">Choose Generation Mode</h2>
        <p className="text-body text-text-secondary">
          Select how you want to generate section content. On-demand is recommended for most cases.
        </p>
      </div>

      {!hasActiveProvider && (
        <div className="rounded-lg border border-status-warning bg-status-warning p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-status-warning-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-body font-medium text-status-warning-foreground">
                AI Provider Required
              </div>
              <p className="text-body text-status-warning-foreground/80 mt-1">
                You need to configure an AI provider before generating content. Your API key is
                encrypted and stored securely.
              </p>
              {onConfigureProvider && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConfigureProvider}
                  className="mt-3"
                >
                  Configure Provider
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <GenerationModeCard
          mode="on-demand"
          title="Generate On Demand"
          description="Generate each section individually as you need them. Recommended for most projects."
          icon={Clock}
          isSelected={selectedMode === 'on-demand'}
          onSelect={() => setSelectedMode('on-demand')}
          estimate={onDemandEstimate}
          isRecommended
        />

        <GenerationModeCard
          mode="complete"
          title="Complete Document"
          description="Generate all sections at once in the background. Faster but uses more AI credits upfront."
          icon={Zap}
          isSelected={selectedMode === 'complete'}
          onSelect={() => setSelectedMode('complete')}
          estimate={completeEstimate}
        />
      </div>

      {selectedMode && estimate && (
        <div className="rounded-lg border border-separator bg-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-section font-semibold text-text-primary">Usage Estimate</h3>
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-body text-interaction hover:text-interaction-hover transition-colors flex items-center gap-1"
            >
              {showBreakdown ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Details
                </>
              )}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-meta text-text-muted uppercase tracking-wide">Provider</div>
              <div className="text-body-lg font-semibold text-text-primary">
                {estimate.provider}
              </div>
              <div className="text-meta text-text-secondary">{estimate.model}</div>
            </div>

            <div className="space-y-1">
              <div className="text-meta text-text-muted uppercase tracking-wide">
                Estimated Tokens
              </div>
              <div className="text-body-lg font-semibold text-text-primary">
                ~{estimate.estimated_tokens.toLocaleString()}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-meta text-text-muted uppercase tracking-wide">
                Approximate Cost
              </div>
              <div className="text-body-lg font-semibold text-text-primary">
                {estimate.currency}{estimate.approximate_cost.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="rounded-md bg-status-info p-3">
            <p className="text-body text-status-info-foreground">
              <strong>Note:</strong> {estimate.uncertainty} Actual usage may vary based on section
              complexity and AI responses. Costs shown are estimates, not guaranteed billing amounts.
            </p>
          </div>

          {showBreakdown && estimate.section_breakdown && (
            <div className="space-y-2 pt-4 border-t border-separator">
              <div className="text-body font-medium text-text-primary">Section Breakdown</div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {estimate.section_breakdown.map((section, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-panel-muted"
                  >
                    <span className="text-body text-text-primary">{section.heading}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-meta text-text-secondary">
                        ~{section.estimated_tokens.toLocaleString()} tokens
                      </span>
                      <span className="text-meta text-text-secondary">
                        {estimate.currency}{section.approximate_cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          onClick={() => selectedMode && onChoose(selectedMode)}
          disabled={!selectedMode || !hasActiveProvider}
        >
          Continue to Editor
        </Button>
      </div>
    </div>
  );
}

interface GenerationModeCardProps {
  mode: 'on-demand' | 'complete';
  title: string;
  description: string;
  icon: React.ElementType;
  isSelected: boolean;
  onSelect: () => void;
  estimate: GenerationEstimate;
  isRecommended?: boolean;
}

function GenerationModeCard({
  mode,
  title,
  description,
  icon: Icon,
  isSelected,
  onSelect,
  estimate,
  isRecommended,
}: GenerationModeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative rounded-lg border p-6 text-left transition-all hover:border-interaction',
        isSelected ? 'border-interaction bg-interaction-muted ring-2 ring-interaction ring-opacity-20' : 'border-separator bg-panel'
      )}
    >
      {isRecommended && (
        <div className="absolute -top-2 right-4">
          <span className="px-2 py-0.5 rounded-full bg-interaction text-interaction-foreground text-meta-sm font-medium">
            Recommended
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-interaction-muted">
          <Icon className="h-5 w-5 text-interaction" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="text-body-lg font-semibold text-text-primary">{title}</h4>
          <p className="text-body text-text-secondary">{description}</p>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1 text-text-secondary">
              <DollarSign className="h-4 w-4" />
              <span className="text-meta">
                {estimate.currency}{estimate.approximate_cost.toFixed(2)}
              </span>
            </div>
            <div className="text-meta text-text-muted">
              ~{estimate.estimated_tokens.toLocaleString()} tokens
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
