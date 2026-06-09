import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type {
  ClarificationRequest,
  OutlineProposal,
  SetupSectionSummary,
} from '@/types/document-setup';

interface OutlineReviewStepProps {
  proposal: OutlineProposal;
  clarificationRequests?: ClarificationRequest[];
  onApprove: (outline: SetupSectionSummary[]) => void;
  onSkipClarification?: (requestId: number) => void;
}

export function OutlineReviewStep({
  proposal,
  clarificationRequests = [],
  onApprove,
  onSkipClarification,
}: OutlineReviewStepProps) {
  const [sections, setSections] = useState<SetupSectionSummary[]>(proposal.outline_json);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showClarifications, setShowClarifications] = useState(true);

  useEffect(() => {
    setSections(proposal.outline_json);
  }, [proposal]);

  const openClarifications = clarificationRequests.filter(
    (item) => !item.answered_at && !item.skipped_at,
  );

  const updateSection = (
    index: number,
    field: 'heading' | 'purpose' | 'description',
    value: string,
  ) => {
    setSections((current) =>
      current.map((section, currentIndex) =>
        currentIndex === index ? { ...section, [field]: value } : section,
      ),
    );
  };

  const addSection = (afterIndex?: number) => {
    setSections((current) => {
      const next = [...current];
      const insertAt = afterIndex === undefined ? next.length : afterIndex + 1;
      next.splice(insertAt, 0, {
        heading: 'New Section',
        description: '',
        purpose: '',
        order_index: insertAt,
      });
      return next.map((section, index) => ({ ...section, order_index: index }));
    });
  };

  const removeSection = (index: number) => {
    setSections((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((section, currentIndex) => ({ ...section, order_index: currentIndex })),
    );
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((section, index) => ({ ...section, order_index: index }));
    });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-title text-text-primary">Review the Outline</h1>
        <p className="mt-3 text-body text-text-secondary">
          Review and adjust the section outline. Rename, reorder, add, or remove sections as needed.
        </p>
      </div>

      {openClarifications.length > 0 && (
        <Surface variant="panel" padding="lg">
          <button
            type="button"
            onClick={() => setShowClarifications((value) => !value)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-status-needs-input-foreground" />
              <div>
                <h2 className="text-body font-semibold text-text-primary">
                  {openClarifications.length} clarification{openClarifications.length === 1 ? '' : 's'} can improve confidence
                </h2>
                <p className="mt-1 text-meta text-text-secondary">
                  Skipping is allowed. Pagemark keeps the affected Sections and the confidence tradeoff explicit.
                </p>
              </div>
            </div>
            {showClarifications ? (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted" />
            )}
          </button>

          {showClarifications && (
            <div className="mt-4 space-y-3">
              {openClarifications.map((request) => (
                <Notice key={request.id} variant="warning" title={request.question}>
                  <div className="space-y-3">
                    <p>{request.context}</p>
                    {request.affected_sections.length > 0 && (
                      <p className="text-meta">
                        Affected Sections: {request.affected_sections.join(', ')}
                      </p>
                    )}
                    {request.confidence_tradeoff && (
                      <p className="text-meta">{request.confidence_tradeoff}</p>
                    )}
                    {request.skippable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSkipClarification?.(request.id)}
                      >
                        Skip for now
                      </Button>
                    )}
                  </div>
                </Notice>
              ))}
            </div>
          )}
        </Surface>
      )}

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-body font-semibold text-text-primary">Outline proposal</h2>
            <p className="mt-1 text-meta text-text-secondary">
              {sections.length} Sections will be created in the Document editor after approval.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => addSection()}>
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>

        <div className="space-y-3">
          {sections.map((section, index) => (
            <Surface key={`${section.heading}-${index}`} variant="muted" padding="none" className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveSection(index, index - 1)}
                    className="text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
                    disabled={index === 0}
                    aria-label="Move section up"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, index + 1)}
                    className="text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
                    disabled={index === sections.length - 1}
                    aria-label="Move section down"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  onClick={() => setExpanded((current) => ({ ...current, [index]: !current[index] }))}
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-text-muted transition-transform',
                      expanded[index] && 'rotate-90',
                    )}
                  />
                  <span className="text-body font-semibold text-text-primary">{section.heading}</span>
                </button>

                <button
                  type="button"
                  className="text-text-muted transition-colors hover:text-text-primary"
                  onClick={() => removeSection(index)}
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {expanded[index] && (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor={`heading-${index}`}>Heading</Label>
                    <input
                      id={`heading-${index}`}
                      value={section.heading}
                      onChange={(event) => updateSection(index, 'heading', event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-panel px-3 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`purpose-${index}`}>Purpose</Label>
                    <input
                      id={`purpose-${index}`}
                      value={section.purpose || ''}
                      onChange={(event) => updateSection(index, 'purpose', event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-panel px-3 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`description-${index}`}>Generation guidance</Label>
                    <textarea
                      id={`description-${index}`}
                      value={section.description || ''}
                      onChange={(event) => updateSection(index, 'description', event.target.value)}
                      className="min-h-24 w-full rounded-md border border-input bg-panel px-3 py-2 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {section.evidence && section.evidence.length > 0 && (
                    <div className="space-y-2">
                      <Label>Repository evidence</Label>
                      <div className="space-y-2">
                        {section.evidence.map((evidence, evidenceIndex) => (
                          <Surface key={`${evidence.description}-${evidenceIndex}`} variant="panel" padding="sm">
                            {evidence.path && (
                              <p className="font-mono text-meta text-text-primary">{evidence.path}</p>
                            )}
                            <p className="mt-1 text-meta text-text-secondary">{evidence.description}</p>
                          </Surface>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => addSection(index)}>
                    Add Section after this one
                  </Button>
                </div>
              )}
            </Surface>
          ))}
        </div>
      </Surface>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onApprove(sections)}>Approve Outline</Button>
      </div>
    </div>
  );
}
