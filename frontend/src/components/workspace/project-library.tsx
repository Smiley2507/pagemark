import * as React from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock3, FolderOpenDot, Grid2X2, List, Pencil, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { Tooltip } from '@/components/ui/tooltip';
import { projectsApi } from '@/api/projects';
import type { Project } from '@/types';
import type { Document as ProjectDocument } from '@/api/documents';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    <ProjectLibraryActions>
      <div className="flex items-center justify-end">
        <SegmentedControl
          label="Project library view"
          value={viewMode}
          onValueChange={onViewModeChange}
          options={[
            { value: 'list', label: <List className="h-4 w-4" /> },
            { value: 'grid', label: <Grid2X2 className="h-4 w-4" /> },
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
    </ProjectLibraryActions>
  );
}

type ProjectActionContext = {
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
};

const ProjectActionsContext = React.createContext<ProjectActionContext | null>(null);

function ProjectLibraryActions({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const updateProject = useMutation({
    mutationFn: () => {
      if (!editingProject) throw new Error('No Project selected');
      return projectsApi.updateProject(editingProject.id, {
        name: name.trim() || editingProject.name,
        description: description.trim() || undefined,
        tags: parseTags(tags),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      setEditingProject(null);
    },
    onError: () => toast.error('Failed to update Project'),
  });

  const deleteProject = useMutation({
    mutationFn: (projectId: number) => projectsApi.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete Project'),
  });

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || '');
    setTags(project.tags.join(', '));
  };

  return (
    <ProjectActionsContext.Provider value={{ onEditProject: openEditProject, onDeleteProject: setDeletingProject }}>
      <div className="space-y-4">{children}</div>

      <Dialog open={editingProject !== null} onOpenChange={(open) => { if (!open) setEditingProject(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription className="sr-only">
              Rename the Project, update its description, or change tags.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Input id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-tags">Tags</Label>
              <Input id="project-tags" value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
              <Button type="button" onClick={() => updateProject.mutate()} disabled={updateProject.isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingProject !== null}
        onOpenChange={(open) => { if (!open) setDeletingProject(null); }}
        title="Delete Project?"
        description={`Delete "${deletingProject?.name || 'this Project'}" and its Documents? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingProject) deleteProject.mutate(deletingProject.id);
          setDeletingProject(null);
        }}
      />
    </ProjectActionsContext.Provider>
  );
}

function ProjectSummaryRow({
  summary,
  onOpen,
}: {
  summary: ProjectWorkspaceSummary;
  onOpen: () => void;
}) {
  const actions = React.useContext(ProjectActionsContext);
  return (
    <Surface
      variant="panel"
      padding="default"
      className="w-full transition-colors hover:bg-panel-muted"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">
              {summary.project.name}
            </h3>
            <ProjectAttentionBadges summary={summary} />
          </div>
          {summary.project.description && (
            <p className="max-w-3xl truncate text-body text-text-secondary">
              {summary.project.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-meta text-text-muted">
            <span>{summary.documentCount} docs</span>
            <span>{summary.templates.slice(0, 2).join(', ') || 'Custom outline'}</span>
            <span>Last activity {formatDate(summary.lastActivityAt)}</span>
          </div>
        </button>

        <div className="flex w-full max-w-sm items-center gap-3 lg:pl-4">
          <div className="min-w-0 flex-1">
            <Progress value={summary.averageProgress} label="Document progress" />
          </div>
          <ProjectActionButtons summary={summary} actions={actions} />
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
  const actions = React.useContext(ProjectActionsContext);
  return (
    <Surface
      variant="panel"
      padding="default"
      className="w-full transition-colors hover:bg-panel-muted"
    >
      <div className="space-y-3">
        <button
          type="button"
          className="w-full space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-lg font-semibold text-text-primary">
              {summary.project.name}
            </h3>
            <ProjectAttentionBadges summary={summary} />
          </div>
          {summary.project.description && (
            <p className="line-clamp-2 text-body text-text-secondary">
              {summary.project.description}
            </p>
          )}
        </button>

        <Progress value={summary.averageProgress} label="Document progress" />

        <div className="grid gap-1 text-meta text-text-secondary">
          <span>{summary.documentCount} docs</span>
          <span>{summary.templates.slice(0, 2).join(', ') || 'Custom outline'}</span>
          <span>Last activity {formatDate(summary.lastActivityAt)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            {summary.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="neutral" showIcon={false}>
                {tag}
              </Badge>
            ))}
          </div>
          <ProjectActionButtons summary={summary} actions={actions} />
        </div>
      </div>
    </Surface>
  );
}

function ProjectActionButtons({
  summary,
  actions,
}: {
  summary: ProjectWorkspaceSummary;
  actions: ProjectActionContext | null;
}) {
  if (!actions) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip content="Edit Project">
        <Button type="button" variant="ghost" size="icon" onClick={() => actions.onEditProject(summary.project)} aria-label="Edit Project">
          <Pencil className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Delete Project">
        <Button type="button" variant="ghost" size="icon" onClick={() => actions.onDeleteProject(summary.project)} aria-label="Delete Project">
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
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

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
