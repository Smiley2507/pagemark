import { useMemo, useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { Template } from '@/types';
import type { TemplateRecommendation, SourceConnectionType } from '@/types/document-setup';

interface TemplateRecommendationStepProps {
  recommendations: TemplateRecommendation[];
  availableTemplates?: Template[];
  sourceType?: SourceConnectionType;
  onSelectTemplate: (templateId: number, recommendation?: TemplateRecommendation) => void;
  onCreateCustom: () => void;
}

export function TemplateRecommendationStep({
  recommendations,
  availableTemplates = [],
  sourceType,
  onSelectTemplate,
  onCreateCustom,
}: TemplateRecommendationStepProps) {
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const sourceConnected = sourceType !== 'none';

  const hiddenTemplateIds = new Set(recommendations.map((item) => item.template_id).filter(Boolean));
  const fallbackTemplates = useMemo(
    () => availableTemplates.filter((template) => !hiddenTemplateIds.has(template.id)),
    [availableTemplates, hiddenTemplateIds],
  );

  const filteredFallbackTemplates = useMemo(
    () => fallbackTemplates.filter((template) => template.name.toLowerCase().includes(templateQuery.toLowerCase())),
    [fallbackTemplates, templateQuery],
  );

  const handleSelect = (templateId: number, recommendation?: TemplateRecommendation) => {
    setSelectedTemplateId(templateId);
    onSelectTemplate(templateId, recommendation);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-title text-text-primary">Choose structure</h1>
        <p className="mt-3 text-body text-text-secondary">
          Pick a starting template, then review the outline.
        </p>
      </div>

      {!sourceConnected && (
        <Notice variant="warning" title="No source connected">
          You can still pick a template or create a custom outline.
        </Notice>
      )}

      <div className="space-y-6">
        <Surface variant="panel" padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-body font-semibold text-text-primary">Recommended</h2>
              <p className="mt-1 text-meta text-text-secondary">Templates ranked from the current source and document context.</p>
            </div>
            {recommendations.length > 0 && <Badge variant="neutral">{recommendations.length} suggested</Badge>}
          </div>

          {recommendations.length > 0 ? (
            <div className="grid gap-3">
              {recommendations.map((recommendation) => (
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
            <Notice variant="warning" title="No recommendations yet">
              Pick from the full template list below.
            </Notice>
          )}
        </Surface>

        <Surface variant="panel" padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-body font-semibold text-text-primary">Browse all templates</h2>
              <p className="mt-1 text-meta text-text-secondary">
                Search to narrow the list.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={templateQuery}
                  onChange={(event) => setTemplateQuery(event.target.value)}
                  placeholder="Search templates"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {filteredFallbackTemplates.length > 0 ? (
              filteredFallbackTemplates.slice(0, 8).map((template) => (
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
              ))
            ) : (
              <p className="text-meta text-text-secondary">No templates match your search.</p>
            )}
          </div>

          <Button variant="outline" className="w-full justify-center gap-2" onClick={onCreateCustom}>
            <Plus className="h-4 w-4" />
            Create Custom Outline
          </Button>
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
        <FileText className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
      </div>
    </button>
  );
}
