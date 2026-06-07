import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';

export interface NewDocumentPayload {
  title: string;
  purpose?: string;
  audience?: string;
  context?: string;
}

interface NewDocumentStepProps {
  projectName?: string;
  isSubmitting?: boolean;
  onSubmit: (payload: NewDocumentPayload) => void;
}

export function NewDocumentStep({
  projectName,
  isSubmitting = false,
  onSubmit,
}: NewDocumentStepProps) {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      purpose: purpose.trim() || undefined,
      audience: audience.trim() || undefined,
      context: context.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <Badge variant="review">New Document</Badge>
        <h1 className="mt-4 text-title text-text-primary">
          {projectName ? (
            <>
              Add a Document to{' '}
              <span className="text-interaction">{projectName}</span>
            </>
          ) : (
            'Add a Document'
          )}
        </h1>
        <p className="mt-3 text-body text-text-secondary">
          This Project already has its source connected and Analysis data available.
          Give the new Document a title and optional guidance so Pagemark can tailor
          Template recommendations to your specific goal.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Surface variant="panel" padding="lg" className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="doc-title">
              Document title <span className="text-status-danger-foreground">*</span>
            </Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleSubmit();
              }}
              placeholder="API Reference, Onboarding Guide, Architecture Overview…"
              autoFocus
            />
            <p className="text-meta text-text-muted">
              Used as the Document heading throughout the workspace.
            </p>
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="doc-purpose">Purpose</Label>
            <Input
              id="doc-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain API endpoints for external integrators"
            />
            <p className="text-meta text-text-muted">
              Clarifies what this Document is for and who will use it. Improves Template matching.
            </p>
          </div>

          {/* Audience */}
          <div className="space-y-2">
            <Label htmlFor="doc-audience">Intended audience</Label>
            <Input
              id="doc-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="External developers, new team members, product managers…"
            />
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label htmlFor="doc-context">Additional context</Label>
            <Input
              id="doc-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Context source code will not reveal"
            />
            <p className="text-meta text-text-muted">
              Business, product, or domain context that supplements repository facts.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="gap-2"
            >
              <FilePlus2 className="h-4 w-4" />
              {isSubmitting ? 'Creating Document…' : 'Create Document'}
            </Button>
          </div>
        </Surface>

        {/* Sidebar hint */}
        <div className="space-y-4">
          <Surface variant="muted" padding="lg">
            <h2 className="text-body font-semibold text-text-primary">What happens next</h2>
            <ul className="mt-3 space-y-2 text-meta text-text-secondary">
              <li>Pagemark reuses the existing Project Analysis to generate recommendations.</li>
              <li>You choose a Template or write a Custom Outline.</li>
              <li>Approve the Outline, then generate or enter the editor manually.</li>
            </ul>
          </Surface>
          <Surface variant="muted" padding="lg">
            <h2 className="text-body font-semibold text-text-primary">Source data shared</h2>
            <p className="mt-2 text-meta text-text-secondary">
              All Documents in this Project share the same repository Analysis.
              No re-analysis is needed when you add a second or third Document.
            </p>
          </Surface>
        </div>
      </div>
    </div>
  );
}
