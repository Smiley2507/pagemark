import React, { useState } from 'react';
import { FileText, Sparkles, Plus, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TemplateRecommendation } from '@/types/document-setup';
import type { Template } from '@/types';

interface TemplateRecommendationStepProps {
  recommendations: TemplateRecommendation[];
  availableTemplates?: Template[];
  hasActiveProvider: boolean;
  onSelectTemplate: (templateId: number, recommendation?: TemplateRecommendation) => void;
  onCreateCustom: () => void;
  onConfigureProvider?: () => void;
}

export function TemplateRecommendationStep({
  recommendations,
  availableTemplates = [],
  hasActiveProvider,
  onSelectTemplate,
  onCreateCustom,
  onConfigureProvider,
}: TemplateRecommendationStepProps) {
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const ruleBasedRecs = recommendations.filter((r) => r.basis === 'rule_based');
  const aiRecs = recommendations.filter((r) => r.basis === 'ai_personalized');

  const topRecommendation = [...aiRecs, ...ruleBasedRecs][0];

  const otherTemplates = availableTemplates.filter(
    (t) => !recommendations.find((r) => r.template_id === t.id)
  );

  const handleSelect = (templateId: number) => {
    setSelectedTemplateId(templateId);
    const recommendation = recommendations.find((r) => r.template_id === templateId);
    onSelectTemplate(templateId, recommendation);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="space-y-2">
        <h2 className="text-title font-semibold text-text-primary">Choose Documentation Template</h2>
        <p className="text-body text-text-secondary">
          Based on your repository analysis, we recommend templates that match your documentation
          needs. You can also create a custom outline from scratch.
        </p>
      </div>

      {!hasActiveProvider && aiRecs.length === 0 && (
        <div className="rounded-lg border border-status-info bg-status-info p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-status-info-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-body font-medium text-status-info-foreground">
                AI-Personalized Recommendations Available
              </div>
              <p className="text-body text-status-info-foreground/80 mt-1">
                Configure an AI provider to receive personalized template recommendations and
                AI-powered outline adaptation based on your specific codebase.
              </p>
              {onConfigureProvider && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConfigureProvider}
                  className="mt-3 gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Configure AI Provider
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {topRecommendation && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-section font-semibold text-text-primary">Recommended</h3>
            <Badge variant={topRecommendation.basis === 'ai_personalized' ? 'info' : 'neutral'}>
              {topRecommendation.basis === 'ai_personalized' ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI-Personalized
                </span>
              ) : (
                'Rule-Based'
              )}
            </Badge>
          </div>

          <TemplateCard
            template={topRecommendation.template!}
            recommendation={topRecommendation}
            isSelected={selectedTemplateId === topRecommendation.template_id}
            onSelect={() => handleSelect(topRecommendation.template_id!)}
            isHighlighted
          />
        </div>
      )}

      {(ruleBasedRecs.length > 1 || aiRecs.length > 1) && (
        <div className="space-y-3">
          <h3 className="text-section font-semibold text-text-primary">Other Recommendations</h3>
          <div className="grid gap-3">
            {[...aiRecs.slice(1), ...ruleBasedRecs.slice(1)].map((rec) => (
              <TemplateCard
                key={rec.id}
                template={rec.template!}
                recommendation={rec}
                isSelected={selectedTemplateId === rec.template_id}
                onSelect={() => handleSelect(rec.template_id!)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-4 border-t border-separator">
        <div className="flex items-center justify-between">
          <h3 className="text-section font-semibold text-text-primary">All Templates</h3>
          <button
            onClick={() => setShowAllTemplates(!showAllTemplates)}
            className="text-body text-interaction hover:text-interaction-hover transition-colors"
          >
            {showAllTemplates ? 'Hide' : 'Show All'}
          </button>
        </div>

        {showAllTemplates && otherTemplates.length > 0 && (
          <div className="grid gap-3">
            {otherTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                onSelect={() => handleSelect(template.id)}
              />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          onClick={onCreateCustom}
          className="w-full gap-2 justify-center"
        >
          <Plus className="h-4 w-4" />
          Create Custom Outline
        </Button>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: {
    id: number;
    name: string;
    description?: string;
    category?: string;
    purpose?: string;
    intended_audience?: string;
    expected_outcome?: string;
    sections_preview?: Array<{
      heading: string;
      description?: string;
    }>;
  };
  recommendation?: TemplateRecommendation;
  isSelected: boolean;
  onSelect: () => void;
  isHighlighted?: boolean;
}

function TemplateCard({
  template,
  recommendation,
  isSelected,
  onSelect,
  isHighlighted,
}: TemplateCardProps) {
  const [showSections, setShowSections] = useState(false);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border p-4 transition-all hover:border-interaction',
        isSelected ? 'border-interaction bg-interaction-muted' : 'border-separator bg-panel',
        isHighlighted && 'ring-2 ring-interaction ring-opacity-20'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-text-secondary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-body-lg font-semibold text-text-primary">{template.name}</h4>
                {template.category && (
                  <Badge variant="neutral" className="text-meta">
                    {template.category}
                  </Badge>
                )}
              </div>

              {template.description && (
                <p className="text-body text-text-secondary mt-1">{template.description}</p>
              )}

              {recommendation && (
                <div className="mt-3 p-3 rounded-md bg-panel-muted">
                  <div className="text-meta font-medium text-text-primary mb-1">
                    Why this template?
                  </div>
                  <p className="text-body text-text-secondary">{recommendation.explanation}</p>
                  {recommendation.basis === 'ai_personalized' && recommendation.provider_usage && (
                    <div className="text-meta text-text-muted mt-2">
                      Analysis used {recommendation.provider_usage.tokens} tokens
                    </div>
                  )}
                </div>
              )}

              {template.sections_preview && template.sections_preview.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSections(!showSections);
                    }}
                    className="text-body text-interaction hover:text-interaction-hover transition-colors flex items-center gap-1"
                  >
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 transition-transform',
                        showSections && 'rotate-90'
                      )}
                    />
                    {showSections ? 'Hide' : 'Show'} sections ({template.sections_preview.length})
                  </button>

                  {showSections && (
                    <div className="mt-2 space-y-1 pl-5">
                      {template.sections_preview.map((section, idx) => (
                        <div key={idx} className="text-body text-text-secondary">
                          <span className="font-medium">{section.heading}</span>
                          {section.description && (
                            <span className="text-text-muted"> — {section.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-interaction">
            <ChevronRight className="h-4 w-4 text-interaction-foreground" />
          </div>
        )}
      </div>
    </button>
  );
}
