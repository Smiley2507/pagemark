import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { OutlineProposal, ClarificationRequest } from '@/types/document-setup';

interface OutlineReviewStepProps {
  proposal: OutlineProposal;
  clarificationRequests?: ClarificationRequest[];
  onApprove: (outline: OutlineProposal['outline_json']) => void;
  onAnswerClarification?: (requestId: number, answer: string) => void;
  onSkipClarification?: (requestId: number) => void;
}

export function OutlineReviewStep({
  proposal,
  clarificationRequests = [],
  onApprove,
  onAnswerClarification,
  onSkipClarification,
}: OutlineReviewStepProps) {
  const [sections, setSections] = useState(proposal.outline_json);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [showClarifications, setShowClarifications] = useState(clarificationRequests.length > 0);

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const updateSection = (index: number, field: 'heading' | 'description' | 'purpose', value: string) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setSections(newSections);
  };

  const addSection = (afterIndex?: number) => {
    const newSection = {
      heading: 'New Section',
      description: '',
      purpose: '',
      order_index: sections.length,
    };
    const newSections = [...sections];
    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : sections.length;
    newSections.splice(insertIndex, 0, newSection);
    // Re-index
    newSections.forEach((s, i) => {
      s.order_index = i;
    });
    setSections(newSections);
  };

  const removeSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index);
    newSections.forEach((s, i) => {
      s.order_index = i;
    });
    setSections(newSections);
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sections.length) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, moved);
    newSections.forEach((s, i) => {
      s.order_index = i;
    });
    setSections(newSections);
  };

  const unansweredClarifications = clarificationRequests.filter((c) => !c.answered_at);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="space-y-2">
        <h2 className="text-title font-semibold text-text-primary">Review Outline</h2>
        <p className="text-body text-text-secondary">
          Review and customize the proposed documentation structure. You can rename, reorder, add,
          or remove sections before generating content.
        </p>
      </div>

      {unansweredClarifications.length > 0 && (
        <div className="rounded-lg border border-status-needs-input bg-status-needs-input p-4">
          <button
            onClick={() => setShowClarifications(!showClarifications)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-status-needs-input-foreground" />
              <div>
                <div className="text-body font-medium text-status-needs-input-foreground">
                  {unansweredClarifications.length} Clarification{unansweredClarifications.length !== 1 && 's'} Needed
                </div>
                <div className="text-body text-status-needs-input-foreground/80">
                  Answer these questions to improve content quality, or skip to continue.
                </div>
              </div>
            </div>
            {showClarifications ? (
              <ChevronDown className="h-5 w-5 text-status-needs-input-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-status-needs-input-foreground" />
            )}
          </button>

          {showClarifications && (
            <div className="mt-4 space-y-4">
              {unansweredClarifications.map((req) => (
                <ClarificationCard
                  key={req.id}
                  request={req}
                  onAnswer={onAnswerClarification}
                  onSkip={onSkipClarification}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-section font-semibold text-text-primary">
            Sections ({sections.length})
          </h3>
          <Button variant="outline" size="sm" onClick={() => addSection()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>

        <div className="space-y-2">
          {sections.map((section, index) => (
            <div
              key={index}
              className="rounded-lg border border-separator bg-panel overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveSection(index, index - 1)}
                    disabled={index === 0}
                    className="text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveSection(index, index + 1)}
                    disabled={index === sections.length - 1}
                    className="text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => toggleSection(index)}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform text-text-muted',
                      expandedSections.has(index) && 'rotate-90'
                    )}
                  />
                  <span className="text-body font-medium text-text-primary">
                    {section.heading}
                  </span>
                </button>

                <button
                  onClick={() => removeSection(index)}
                  className="text-text-muted hover:text-status-danger-foreground transition-colors"
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {expandedSections.has(index) && (
                <div className="space-y-4 p-4 pt-2 border-t border-separator">
                  <div className="space-y-2">
                    <Label htmlFor={`heading-${index}`}>Heading</Label>
                    <Input
                      id={`heading-${index}`}
                      value={section.heading}
                      onChange={(e) => updateSection(index, 'heading', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`purpose-${index}`}>Purpose</Label>
                    <Input
                      id={`purpose-${index}`}
                      value={section.purpose || ''}
                      onChange={(e) => updateSection(index, 'purpose', e.target.value)}
                      placeholder="What should this section explain?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`description-${index}`}>Description</Label>
                    <textarea
                      id={`description-${index}`}
                      value={section.description || ''}
                      onChange={(e) => updateSection(index, 'description', e.target.value)}
                      placeholder="Additional guidance for content generation"
                      className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    />
                  </div>

                  {section.evidence && section.evidence.length > 0 && (
                    <div className="space-y-2">
                      <Label>Repository Evidence</Label>
                      <div className="space-y-1">
                        {section.evidence.map((ev, evIdx) => (
                          <div
                            key={evIdx}
                            className="text-meta text-text-secondary bg-panel-muted rounded p-2"
                          >
                            {ev.path && <div className="font-mono">{ev.path}</div>}
                            <div>{ev.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSection(index)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section After
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={() => onApprove(sections)}>Approve Outline</Button>
      </div>
    </div>
  );
}

interface ClarificationCardProps {
  request: ClarificationRequest;
  onAnswer?: (requestId: number, answer: string) => void;
  onSkip?: (requestId: number) => void;
}

function ClarificationCard({ request, onAnswer, onSkip }: ClarificationCardProps) {
  const [answer, setAnswer] = useState('');

  return (
    <div className="rounded-md border border-separator bg-panel p-4 space-y-3">
      <div>
        <div className="text-body font-medium text-text-primary">{request.question}</div>
        <div className="text-body text-text-secondary mt-1">{request.context}</div>
      </div>

      {request.affected_sections.length > 0 && (
        <div className="text-meta text-text-muted">
          Affects: {request.affected_sections.join(', ')}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`clarification-${request.id}`}>Your Answer</Label>
        <textarea
          id={`clarification-${request.id}`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Provide context to improve these sections..."
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onAnswer && onAnswer(request.id, answer)}
          disabled={!answer.trim()}
        >
          Submit Answer
        </Button>
        {request.skippable && onSkip && (
          <Button variant="ghost" size="sm" onClick={() => onSkip(request.id)}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
