import React, { useCallback } from 'react';
import { Award, Copy, Check, X, Edit3, Trash2, FileText, Users, Target, BookOpen, Cpu } from 'lucide-react';
import type { Template } from '@/types';
import { Button } from '@/components/ui/button';

interface TemplateDetailModalProps {
  template: Template;
  onClose: () => void;
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => void;
}

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  onClose,
  onEdit,
  onDelete,
}) => {
  const isCustom = !template.is_builtin;
  const [copied, setCopied] = React.useState(false);

  const handleCopyPrompt = useCallback(async () => {
    if (template.system_prompt) {
      await navigator.clipboard.writeText(template.system_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [template.system_prompt]);

  const sections = template.sections_json as Array<{ heading: string; description?: string; guidance?: string; expected_sources?: string[] }> | null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-section font-semibold text-foreground">{template.name}</h2>
            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-meta-sm font-medium text-muted-foreground">
              {template.category}
            </span>
            {template.is_builtin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta-sm font-medium">
                <Award className="h-3 w-3" />
                Built-in
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCustom && onEdit && (
              <button
                onClick={() => { onEdit(template); onClose(); }}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Edit template"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
            {isCustom && onDelete && (
              <button
                onClick={() => { onDelete(template); onClose(); }}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-red-500 transition-colors"
                title="Delete template"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">Purpose</p>
                <p className="mt-1 text-body text-foreground">{template.purpose || 'Not specified.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">Intended Audience</p>
                <p className="mt-1 text-body text-foreground">{template.intended_audience || 'Not specified.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">Expected Outcome</p>
                <p className="mt-1 text-body text-foreground">{template.expected_outcome || 'Not specified.'}</p>
              </div>
            </div>
          </div>

          {sections && sections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">Outline</p>
                <span className="text-meta-sm text-muted-foreground">({sections.length} sections)</span>
              </div>
              <div className="mt-3 space-y-2">
                {sections.map((sec, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-body font-medium text-foreground">
                      {i + 1}. {sec.heading}
                    </p>
                    {sec.description && (
                      <p className="mt-1 text-meta-sm text-muted-foreground">{sec.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {template.guidance && (
            <div>
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">Writing Guidance</p>
              </div>
              <p className="mt-2 text-body text-foreground whitespace-pre-wrap">{template.guidance}</p>
            </div>
          )}

          {template.system_prompt && (
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <p className="text-meta-sm font-medium text-muted-foreground uppercase tracking-wider">AI System Prompt</p>
                </div>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 rounded px-2 py-1 text-meta-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy</>
                  )}
                </button>
              </div>
              <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-muted p-3 text-meta-sm text-foreground whitespace-pre-wrap font-mono">
                {template.system_prompt}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};
