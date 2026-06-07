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
    <div className="grid gap-3 rounded-md border border-border bg-panel px-3 py-3 transition-colors hover:bg-canvas lg:grid-cols-[minmax(0,1fr)_180px_132px_auto] lg:items-center">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-body font-semibold text-text-primary">{document.title}</h3>
          <DocumentAttentionBadges document={document} />
        </div>
        <p className="mt-0.5 truncate text-meta text-text-secondary">
          {document.purpose || document.templateName || 'Custom outline'}
        </p>
      </button>

      <div className="min-w-0 text-meta text-text-muted">
        <span className="block truncate">{document.templateName || 'Custom outline'}</span>
        {document.tags.length > 0 && (
          <span className="block truncate">{document.tags.slice(0, 2).join(', ')}</span>
        )}
      </div>

      <div className="min-w-0">
        <Progress value={document.progress} label="Review progress" />
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <span className="text-meta text-text-muted">{formatDate(document.lastActivityAt)}</span>
        <DocumentActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
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
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h3 className="truncate text-body font-semibold text-text-primary">{document.title}</h3>
            <p className="mt-1 line-clamp-2 min-h-10 text-meta text-text-secondary">
              {document.purpose || document.templateName || 'Custom outline'}
            </p>
          </button>
          <DocumentActions onEdit={onEdit} onDelete={onDelete} />
        </div>

        <div className="flex min-h-6 flex-wrap gap-1">
          <DocumentAttentionBadges document={document} />
        </div>

        <Progress value={document.progress} label="Review progress" />

        <div className="grid grid-cols-2 gap-2 text-meta text-text-secondary">
          <span>{document.templateName || 'Custom outline'}</span>
          <span className="text-right">{formatDate(document.lastActivityAt)}</span>
          {document.tags.length > 0 && (
            <span className="col-span-2 truncate">{document.tags.slice(0, 3).join(', ')}</span>
          )}
        </div>
      </div>
    </Surface>
  );
}

function DocumentAttentionBadges({ document }: { document: WorkspaceDocumentItem }) {
  return (
    <>
      {document.statusVariant !== 'neutral' && document.statusVariant !== 'success' && (
        <Badge variant={document.statusVariant}>
          {document.statusLabel}
        </Badge>
      )}
      {document.freshnessVariant === 'warning' && (
        <Badge variant={document.freshnessVariant} showIcon={false}>
          {document.freshnessLabel}
        </Badge>
      )}
    </>
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
  return { label: '', variant: 'neutral' as const };
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
