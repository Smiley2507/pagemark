import { useMemo, useState, type ElementType } from 'react';
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { initialGenerationMode, generationModeRequiresProvider } from '@/lib/document-setup-flow';
import { cn } from '@/lib/utils';
import type { GenerationEstimate } from '@/types/document-setup';

interface GenerationChoiceStepProps {
  onDemandEstimate?: GenerationEstimate;
  completeEstimate?: GenerationEstimate;
  hasActiveProvider: boolean;
  onChoose: (mode: 'on-demand' | 'complete' | 'manual') => void;
  onBack?: () => void;
  onConfigureProvider?: () => void;
  isSubmitting?: boolean;
}

type ChoiceMode = 'on-demand' | 'complete' | 'manual';

export function GenerationChoiceStep({
  onDemandEstimate,
  completeEstimate,
  hasActiveProvider,
  onChoose,
  onBack,
  onConfigureProvider,
  isSubmitting = false,
}: GenerationChoiceStepProps) {
  const [selectedMode, setSelectedMode] = useState<ChoiceMode>(
    initialGenerationMode(hasActiveProvider),
  );
  const [showBreakdown, setShowBreakdown] = useState(true);

  const selectedEstimate = useMemo(() => {
    if (selectedMode === 'on-demand') return onDemandEstimate;
    if (selectedMode === 'complete') return completeEstimate;
    return undefined;
  }, [completeEstimate, onDemandEstimate, selectedMode]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-title text-text-primary">Choose how to enter the Document</h1>
        <p className="mt-3 text-body text-text-secondary">
          Start with a useful draft, generate only the approved sections, or enter the editor without AI.
        </p>
      </div>

      {!hasActiveProvider && (
        <Notice variant="warning" title="No active provider is configured">
          You can enter the editor and write manually. Configure an AI provider when you're ready for AI-powered generation.
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ModeCard
          selected={selectedMode === 'manual'}
          title="Enter editor without generation"
          subtitle="No provider usage"
          description="Create the Section structure now and start writing manually. AI generation remains available later."
          badge={!hasActiveProvider ? 'Recommended now' : undefined}
          icon={FilePenLine}
          onClick={() => setSelectedMode('manual')}
        />
        <ModeCard
          selected={selectedMode === 'on-demand'}
          title="Generate approved Sections"
          subtitle="Lower relative usage"
          description="Draft the approved Outline section-by-section now, while keeping each Section reviewable in the editor."
          badge={hasActiveProvider ? 'Recommended' : 'Provider required'}
          icon={Sparkles}
          onClick={() => setSelectedMode('on-demand')}
        />
        <ModeCard
          selected={selectedMode === 'complete'}
          title="Generate the complete Document"
          subtitle="Higher relative usage"
          description="Draft the whole Document before opening the editor when the overview and Outline are stable."
          badge={hasActiveProvider ? undefined : 'Provider required'}
          icon={Zap}
          onClick={() => setSelectedMode('complete')}
        />
      </div>

      {selectedMode !== 'manual' && selectedEstimate && (
        <Surface variant="panel" padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-body font-semibold text-text-primary">Usage estimate</h2>
              <p className="mt-1 text-meta text-text-secondary">
                Approximate provider usage before {selectedMode === 'complete' ? 'complete-Document generation' : 'Section generation'}.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowBreakdown((value) => !value)}>
              {showBreakdown ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide breakdown
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show breakdown
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <EstimateMetric label="Provider" value={selectedEstimate.provider || 'Not configured'} hint={selectedEstimate.model || ''} />
            <EstimateMetric label="Relative usage" value={selectedEstimate.relative_usage} />
            <EstimateMetric
              label="Estimated tokens"
              value={`~${(selectedEstimate.estimated_prompt_tokens + selectedEstimate.estimated_completion_tokens).toLocaleString()}`}
            />
            <EstimateMetric
              label="Approximate cost"
              value={`$${selectedEstimate.estimated_cost.toFixed(4)}`}
              hint="Not guaranteed billing"
            />
          </div>

          <Notice variant="generation" title="Estimate uncertainty remains explicit">
            {selectedEstimate.uncertainty} {selectedEstimate.pricing_note || 'Actual provider billing may differ from these estimates.'}
          </Notice>

          {showBreakdown && selectedEstimate.section_breakdown && selectedEstimate.section_breakdown.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-4 w-4 text-interaction" />
                <h3 className="text-body font-semibold text-text-primary">Section-level breakdown</h3>
              </div>
              <div className="space-y-2">
                {selectedEstimate.section_breakdown.map((section) => (
                  <Surface key={section.section_id} variant="muted" padding="default">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-body font-semibold text-text-primary">{section.heading}</h4>
                        <p className="mt-1 text-meta text-text-secondary">{section.uncertainty}</p>
                      </div>
                      <div className="text-right text-meta text-text-secondary">
                        <div>~{(section.estimated_prompt_tokens + section.estimated_completion_tokens).toLocaleString()} tokens</div>
                        <div>${section.estimated_cost.toFixed(4)}</div>
                      </div>
                    </div>
                  </Surface>
                ))}
              </div>
            </div>
          )}
        </Surface>
      )}

      {generationModeRequiresProvider(selectedMode) && !hasActiveProvider && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={onConfigureProvider}>Configure provider for this AI action</Button>
          <Button variant="outline" onClick={() => setSelectedMode('manual')}>
            Enter editor without generation
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to outline
          </Button>
        )}
        <Button
          disabled={isSubmitting || (generationModeRequiresProvider(selectedMode) && !hasActiveProvider)}
          onClick={() => onChoose(selectedMode)}
        >
          {isSubmitting
            ? 'Preparing…'
            : selectedMode === 'manual'
              ? 'Enter editor now'
              : 'Start generation and enter editor'}
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  title,
  subtitle,
  description,
  badge,
  icon: Icon,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border p-5 text-left transition-colors',
        selected
          ? 'border-interaction bg-interaction-muted'
          : 'border-border bg-panel hover:bg-panel-muted',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-panel-muted">
          <Icon className="h-5 w-5 text-interaction" />
        </div>
        {badge && <Badge variant="neutral">{badge}</Badge>}
      </div>
      <h2 className="mt-4 text-body font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-meta-sm uppercase tracking-wide text-text-muted">{subtitle}</p>
      <p className="mt-3 text-meta text-text-secondary">{description}</p>
    </button>
  );
}

function EstimateMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Surface variant="muted" padding="default">
      <div className="text-meta-sm uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 text-body font-semibold text-text-primary">{value}</div>
      {hint && <div className="mt-1 text-meta text-text-secondary">{hint}</div>}
    </Surface>
  );
}
