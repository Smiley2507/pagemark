import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Surface } from '@/components/ui/surface';
import { Tooltip } from '@/components/ui/tooltip';

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
  purpose?: string;
  audience?: string;
  context?: string;
}

export function DocumentSummaryRow({
  document,
  onOpen,
  onEdit,
  onDelete,
}: {
  document: WorkspaceDocumentItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Surface
      variant="panel"
      padding="default"
      className="w-full transition-colors hover:bg-panel-muted"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">{document.title}</h3>
            <Badge variant={document.statusVariant}>{document.statusLabel}</Badge>
            {document.freshnessVariant === 'warning' && (
              <Badge variant={document.freshnessVariant} showIcon={false}>
                {document.freshnessLabel}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-meta text-text-secondary">
            <span>{document.templateName || 'Custom outline'}</span>
            <span>Last activity {formatDate(document.lastActivityAt)}</span>
          </div>
        </button>

        <div className="flex w-full max-w-sm items-center gap-3">
          <div className="min-w-0 flex-1">
            <Progress value={document.progress} label="Review progress" />
          </div>
          <DocumentActions onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </Surface>
  );
}

export function DocumentSummaryCard({
  document,
  onOpen,
  onEdit,
  onDelete,
}: {
  document: WorkspaceDocumentItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Surface
      variant="panel"
      padding="default"
      className="w-full transition-colors hover:bg-panel-muted"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onOpen}
          className="w-full space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">{document.title}</h3>
            <Badge variant={document.statusVariant}>{document.statusLabel}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {document.freshnessVariant === 'warning' && (
              <Badge variant={document.freshnessVariant} showIcon={false}>
                {document.freshnessLabel}
              </Badge>
            )}
            <Badge variant="neutral" showIcon={false}>
              {document.templateName || 'Custom outline'}
            </Badge>
          </div>
        </button>

        <Progress value={document.progress} label="Review progress" />

        <div className="grid gap-1 text-meta text-text-secondary">
          <span>Last activity {formatDate(document.lastActivityAt)}</span>
          <span>{document.tags.slice(0, 3).join(', ')}</span>
        </div>

        <div className="flex justify-end">
          <DocumentActions onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </Surface>
  );
}

function DocumentActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip content="Edit Document">
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="Edit Document">
          <Pencil className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Delete Document">
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete Document">
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
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
      <h2 className="mt-3 text-section font-semibold text-text-primary">No Documents yet</h2>
    </Surface>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
