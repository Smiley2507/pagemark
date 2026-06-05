import { Clock3, FolderOpenDot, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import type { Project } from '@/types';
import type { Document as ProjectDocument } from '@/api/documents';
import { cn } from '@/lib/utils';

export type ProjectLibraryFilter = 'all' | 'active' | 'stale' | 'resume';
export type ProjectLibraryView = 'list' | 'grid';

export interface ProjectWorkspaceSummary {
  project: Project;
  documents: ProjectDocument[];
  documentCount: number;
  averageProgress: number;
  activeGenerationCount: number;
  staleDocumentCount: number;
  needsInputCount: number;
  reviewedDocumentCount: number;
  lastActivityAt: string;
  templates: string[];
  tags: string[];
}

export function buildProjectWorkspaceSummary(
  project: Project,
  documents: ProjectDocument[]
): ProjectWorkspaceSummary {
  const templates = Array.from(
    new Set(documents.map((document) => document.template?.name).filter(Boolean))
  ) as string[];
  const lastActivityAt = documents
    .map((document) => document.last_activity_at)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || project.updated_at;
  const averageProgress = documents.length > 0
    ? Math.round(documents.reduce((sum, document) => sum + document.progress.pct, 0) / documents.length)
    : project.completion_pct || 0;

  return {
    project,
    documents,
    documentCount: documents.length,
    averageProgress,
    activeGenerationCount: documents.filter((document) => isGenerating(document.status)).length,
    staleDocumentCount: documents.filter((document) => isStale(document.freshness, document.status)).length,
    needsInputCount: documents.filter((document) => needsInput(document.status)).length,
    reviewedDocumentCount: documents.filter((document) => isReviewed(document.status)).length,
    lastActivityAt,
    templates,
    tags: project.tags,
  };
}

export function filterProjectSummaries(
  summaries: ProjectWorkspaceSummary[],
  filter: ProjectLibraryFilter,
  recentProjectIds: number[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  return summaries.filter((summary) => {
    const matchesQuery = normalizedQuery.length === 0 || [
      summary.project.name,
      summary.project.description || '',
      summary.templates.join(' '),
      summary.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (filter === 'active') {
      return summary.activeGenerationCount > 0 || summary.needsInputCount > 0;
    }
    if (filter === 'stale') {
      return summary.staleDocumentCount > 0;
    }
    if (filter === 'resume') {
      return recentProjectIds.includes(summary.project.id);
    }
    return true;
  });
}

export function ProjectLibrary({
  summaries,
  viewMode,
  onViewModeChange,
  onOpenProject,
  onCreateProject,
  emptyTitle,
  emptyDescription,
}: {
  summaries: ProjectWorkspaceSummary[];
  viewMode: ProjectLibraryView;
  onViewModeChange: (value: string) => void;
  onOpenProject: (projectId: number) => void;
  onCreateProject: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={(
          <Button type="button" onClick={onCreateProject}>
            Create Project
          </Button>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <SegmentedControl
          label="Project library view"
          value={viewMode}
          onValueChange={onViewModeChange}
          options={[
            { value: 'list', label: 'List' },
            { value: 'grid', label: 'Grid' },
          ]}
        />
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <ProjectSummaryRow
              key={summary.project.id}
              summary={summary}
              onOpen={() => onOpenProject(summary.project.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {summaries.map((summary) => (
            <ProjectSummaryCard
              key={summary.project.id}
              summary={summary}
              onOpen={() => onOpenProject(summary.project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectSummaryRow({
  summary,
  onOpen,
}: {
  summary: ProjectWorkspaceSummary;
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">
              {summary.project.name}
            </h3>
            <ProjectAttentionBadges summary={summary} />
          </div>
          {summary.project.description && (
            <p className="max-w-3xl text-body text-text-secondary">
              {summary.project.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-meta text-text-muted">
            <span>{summary.documentCount} Documents</span>
            <span>Templates: {summary.templates.slice(0, 2).join(', ') || 'Custom outline'}</span>
            <span>Last activity {formatDate(summary.lastActivityAt)}</span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3 lg:pl-4">
          <Progress value={summary.averageProgress} label="Document progress" />
          <div className="flex flex-wrap gap-2">
            {summary.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="neutral" showIcon={false}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
}

function ProjectSummaryCard({
  summary,
  onOpen,
}: {
  summary: ProjectWorkspaceSummary;
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
            <h3 className="text-body-lg font-semibold text-text-primary">
              {summary.project.name}
            </h3>
            <ProjectAttentionBadges summary={summary} />
          </div>
          {summary.project.description && (
            <p className="text-body text-text-secondary">
              {summary.project.description}
            </p>
          )}
        </div>

        <Progress value={summary.averageProgress} label="Document progress" />

        <div className="grid gap-2 text-meta text-text-secondary">
          <span>{summary.documentCount} Documents in workspace</span>
          <span>{summary.templates.slice(0, 2).join(', ') || 'Custom outline'}</span>
          <span>Last activity {formatDate(summary.lastActivityAt)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="neutral" showIcon={false}>
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Surface>
  );
}

function ProjectAttentionBadges({ summary }: { summary: ProjectWorkspaceSummary }) {
  return (
    <>
      {summary.activeGenerationCount > 0 && (
        <Badge variant="generation">
          {summary.activeGenerationCount} generating
        </Badge>
      )}
      {summary.needsInputCount > 0 && (
        <Badge variant="needsInput">
          {summary.needsInputCount} need input
        </Badge>
      )}
      {summary.staleDocumentCount > 0 && (
        <Badge variant="warning">
          {summary.staleDocumentCount} source changes
        </Badge>
      )}
    </>
  );
}

export function SignalList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: 'resume' | 'generation' | 'stale';
  items: Array<{
    id: string;
    title: string;
    description: string;
    meta: string;
    badge?: {
      label: string;
      variant: 'neutral' | 'warning' | 'generation' | 'needsInput' | 'success' | 'review';
    };
    onOpen: () => void;
  }>;
  empty: string;
}) {
  const Icon = icon === 'resume'
    ? Clock3
    : icon === 'generation'
      ? Sparkles
      : TriangleAlert;

  return (
    <Surface variant="panel" padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        <h2 className="text-section font-semibold text-text-primary">{title}</h2>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-body text-text-muted">
          <FolderOpenDot className="h-4 w-4" aria-hidden="true" />
          <span>{empty}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onOpen}
              className={cn(
                'flex w-full items-start justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors',
                'hover:bg-panel-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-medium text-text-primary">{item.title}</span>
                  {item.badge && (
                    <Badge variant={item.badge.variant} showIcon={false}>
                      {item.badge.label}
                    </Badge>
                  )}
                </div>
                <p className="text-body text-text-secondary">{item.description}</p>
                <p className="text-meta text-text-muted">{item.meta}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

function isGenerating(status: string) {
  return status.toLowerCase().includes('generat');
}

function needsInput(status: string) {
  return status.toLowerCase().includes('needs_input') || status.toLowerCase().includes('needs input');
}

function isReviewed(status: string) {
  return status.toLowerCase() === 'reviewed';
}

function isStale(freshness: string, status: string) {
  return freshness.toLowerCase().includes('stale') || status.toLowerCase().includes('stale');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
