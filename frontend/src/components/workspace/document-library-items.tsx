import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Surface } from '@/components/ui/surface';

export interface WorkspaceDocumentItem {
  id: number;
  title: string;
  templateName?: string;
  statusLabel: string;
  statusVariant: 'neutral' | 'warning' | 'generation' | 'needsInput' | 'success' | 'review';
  freshnessLabel: string;
  freshnessVariant: 'neutral' | 'warning' | 'success';
  progress: number;
  lastActivityAt: string;
  tags: string[];
}

export function DocumentSummaryRow({
  document,
  onOpen,
}: {
  document: WorkspaceDocumentItem;
  onOpen: () => void;
}) {
  return (
    <Surface
      as="button"
      variant="panel"
      padding="default"
      className="w-full text-left transition-colors hover:bg-panel-muted focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">{document.title}</h3>
            <Badge variant={document.statusVariant}>{document.statusLabel}</Badge>
            <Badge variant={document.freshnessVariant} showIcon={false}>
              {document.freshnessLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-meta text-text-secondary">
            <span>Template: {document.templateName || 'Custom outline'}</span>
            <span>Last activity {formatDate(document.lastActivityAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <Badge key={tag} variant="neutral" showIcon={false}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm">
          <Progress value={document.progress} label="Review progress" />
        </div>
      </div>
    </Surface>
  );
}

export function DocumentSummaryCard({
  document,
  onOpen,
}: {
  document: WorkspaceDocumentItem;
  onOpen: () => void;
}) {
  return (
    <Surface
      as="button"
      variant="panel"
      padding="lg"
      className="w-full text-left transition-colors hover:bg-panel-muted focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">{document.title}</h3>
            <Badge variant={document.statusVariant}>{document.statusLabel}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={document.freshnessVariant} showIcon={false}>
              {document.freshnessLabel}
            </Badge>
            <Badge variant="neutral" showIcon={false}>
              {document.templateName || 'Custom outline'}
            </Badge>
          </div>
        </div>

        <Progress value={document.progress} label="Review progress" />

        <div className="grid gap-2 text-meta text-text-secondary">
          <span>Last activity {formatDate(document.lastActivityAt)}</span>
          <span>{document.tags.length > 0 ? document.tags.join(', ') : 'No tags yet'}</span>
        </div>
      </div>
    </Surface>
  );
}

export function mapDocumentStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('reviewed')) {
    return { label: 'Reviewed', variant: 'success' as const };
  }
  if (normalized.includes('needs_input') || normalized.includes('needs input')) {
    return { label: 'Needs input', variant: 'needsInput' as const };
  }
  if (normalized.includes('generat')) {
    return { label: 'Generating', variant: 'generation' as const };
  }
  if (normalized.includes('draft')) {
    return { label: 'Draft', variant: 'review' as const };
  }
  return { label: 'In progress', variant: 'neutral' as const };
}

export function mapFreshness(freshness: string) {
  const normalized = freshness.toLowerCase();
  if (normalized.includes('stale')) {
    return { label: 'Source changed', variant: 'warning' as const };
  }
  if (normalized.includes('fresh')) {
    return { label: 'Fresh', variant: 'success' as const };
  }
  return { label: 'Freshness unknown', variant: 'neutral' as const };
}

export function EmptyDocumentState() {
  return (
    <Surface variant="muted" padding="lg" className="flex flex-col items-center justify-center text-center">
      <FileText className="h-8 w-8 text-text-muted" aria-hidden="true" />
      <h2 className="mt-3 text-section font-semibold text-text-primary">No Documents yet</h2>
      <p className="mt-2 text-body text-text-secondary">
        Create the first Document in this Project workspace to start generation and review.
      </p>
    </Surface>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
