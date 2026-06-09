import { useMemo, useState } from 'react';
import { ChevronRight, FileText, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { Template } from '@/types';
import type { TemplateRecommendation, SourceConnectionType } from '@/types/document-setup';

interface TemplateRecommendationStepProps {
  recommendations: TemplateRecommendation[];
  availableTemplates?: Template[];
  hasActiveProvider: boolean;
  sourceType?: SourceConnectionType;
  requestingAiRecommendations?: boolean;
  onSelectTemplate: (templateId: number, recommendation?: TemplateRecommendation) => void;
  onCreateCustom: () => void;
  onConfigureProvider?: () => void;
  onRequestAiRecommendations?: () => void;
}

export function TemplateRecommendationStep({
  recommendations,
  availableTemplates = [],
  hasActiveProvider,
  sourceType,
  requestingAiRecommendations = false,
  onSelectTemplate,
  onCreateCustom,
  onConfigureProvider,
  onRequestAiRecommendations,
}: TemplateRecommendationStepProps) {
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const ruleBased = recommendations.filter((item) => item.basis === 'rule_based');
  const aiPersonalized = recommendations.filter((item) => item.basis === 'ai_personalized');
  const sourceConnected = sourceType !== 'none';

  const hiddenTemplateIds = new Set(recommendations.map((item) => item.template_id).filter(Boolean));
  const fallbackTemplates = useMemo(
    () => availableTemplates.filter((template) => !hiddenTemplateIds.has(template.id)),
    [availableTemplates, hiddenTemplateIds],
  );

  const handleSelect = (templateId: number, recommendation?: TemplateRecommendation) => {
    setSelectedTemplateId(templateId);
    onSelectTemplate(templateId, recommendation);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-title text-text-primary">Choose the first Document structure</h1>
        <p className="mt-3 text-body text-text-secondary">
          Choose a documentation structure based on your code analysis. Rule-based picks work
          without an AI provider; AI-personalized ones tailor the outline to your project.
        </p>
      </div>

      {!sourceConnected && (
        <Notice variant="warning" title="No source connected">
          No analysis data is available. You can still pick a template or create a custom outline,
          but recommendations won't be based on your code.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-body font-semibold text-text-primary">Rule-based recommendations</h2>
                <p className="mt-1 text-meta text-text-secondary">
                  Available without a provider credential.
                </p>
              </div>
              <Badge variant="neutral">No provider usage</Badge>
            </div>

            {ruleBased.length > 0 ? (
              <div className="grid gap-3">
                {ruleBased.map((recommendation) => (
                  <TemplateCard
                    key={recommendation.id}
                    template={recommendation.template}
                    recommendation={recommendation}
                    selected={selectedTemplateId === recommendation.template_id}
                    onSelect={() => handleSelect(recommendation.template_id!, recommendation)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-meta text-text-secondary">
                No rule-based recommendations available yet.
              </p>
            )}
          </Surface>

          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-body font-semibold text-text-primary">AI-personalized recommendation</h2>
                <p className="mt-1 text-meta text-text-secondary">
                  Uses your AI provider to tailor the outline to your project.
                </p>
              </div>
              <Badge variant="generation">Provider-consuming action</Badge>
            </div>

            {!sourceConnected ? (
                <Notice variant="warning" title="Source connection required">
                Connect a source code repository first to enable AI-personalized recommendations.
              </Notice>
            ) : aiPersonalized.length > 0 ? (
              <div className="grid gap-3">
                {aiPersonalized.map((recommendation) => (
                  <TemplateCard
                    key={recommendation.id}
                    template={recommendation.template}
                    recommendation={recommendation}
                    selected={selectedTemplateId === recommendation.template_id}
                    onSelect={() => handleSelect(recommendation.template_id!, recommendation)}
                  />
                ))}
              </div>
            ) : (
              <>
              <Notice variant="generation" title="Provider usage required">
                Creating an AI-personalized recommendation uses your provider and may consume tokens.
              </Notice>
                <div className="flex flex-wrap gap-3">
                  {hasActiveProvider ? (
                    <Button
                      variant="outline"
                      disabled={requestingAiRecommendations}
                      onClick={onRequestAiRecommendations}
                    >
                      {requestingAiRecommendations ? 'Generating recommendation…' : 'Generate AI-personalized recommendation'}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={onConfigureProvider}>
                      Configure provider for AI recommendation
                    </Button>
                  )}
                </div>
              </>
            )}
          </Surface>

          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-body font-semibold text-text-primary">Other Templates</h2>
                <p className="mt-1 text-meta text-text-secondary">
                  Browse all available templates.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAllTemplates((value) => !value)}>
                {showAllTemplates ? 'Hide' : 'Show'} list
              </Button>
            </div>

            {showAllTemplates && fallbackTemplates.length > 0 && (
              <div className="grid gap-3">
                {fallbackTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={{
                      ...template,
                      sections_preview: Array.isArray(template.sections_json)
                        ? template.sections_json.map((section) =>
                            typeof section === 'string'
                              ? { heading: section }
                              : { heading: section.heading, description: section.description },
                          )
                        : undefined,
                    }}
                    selected={selectedTemplateId === template.id}
                    onSelect={() => handleSelect(template.id)}
                  />
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full justify-center gap-2" onClick={onCreateCustom}>
              <Plus className="h-4 w-4" />
              Create Custom Outline
            </Button>
          </Surface>
        </div>

        <Surface variant="muted" padding="lg">
          <h2 className="text-body font-semibold text-text-primary">How it works</h2>
          <ul className="mt-3 space-y-2 text-meta text-text-secondary">
            <li>Rule-based picks work without an AI provider.</li>
            <li>AI-personalized picks require a configured provider.</li>
            <li>Custom outlines let you start from scratch.</li>
          </ul>
        </Surface>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  recommendation,
  selected,
  onSelect,
}: {
  template?: TemplateRecommendation['template'] | (Template & { sections_preview?: Array<{ heading: string; description?: string }> });
  recommendation?: TemplateRecommendation;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!template) return null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-interaction bg-interaction-muted'
          : 'border-border bg-panel hover:bg-panel-muted',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-interaction" />
            <h3 className="text-body font-semibold text-text-primary">{template.name}</h3>
            {recommendation && (
              <Badge variant={recommendation.basis === 'ai_personalized' ? 'generation' : 'neutral'}>
                {recommendation.basis === 'ai_personalized' ? 'AI-personalized' : 'Rule-based'}
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="mt-2 text-meta text-text-secondary">{template.description}</p>
          )}
          {recommendation?.explanation && (
            <p className="mt-3 text-meta text-text-secondary">{recommendation.explanation}</p>
          )}
          {recommendation?.provider_usage && (
            <p className="mt-2 text-meta text-text-muted">
              Approximate provider usage: {recommendation.provider_usage.tokens.toLocaleString()} tokens.
            </p>
          )}
          {template.sections_preview && template.sections_preview.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {template.sections_preview.slice(0, 4).map((section) => (
                <Badge key={section.heading} variant="neutral">
                  {section.heading}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
      </div>
    </button>
  );
}
