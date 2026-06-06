import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { FileText, FolderClock, FolderKanban, GitBranch, PenLine, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { documentsApi } from '@/api/documents';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import {
  buildProjectWorkspaceSummary,
  filterProjectSummaries,
  ProjectLibrary,
} from '@/components/workspace/project-library';

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'active' | 'stale' | 'resume'>('all');
  const viewMode = useViewPreferenceStore((state) => state.getViewMode('home-projects'));
  const setViewMode = useViewPreferenceStore((state) => state.setViewMode);
  const getRecentProjects = useViewPreferenceStore((state) => state.getRecentProjects);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({}),
  });

  const documentQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['documents', project.id],
      queryFn: () => documentsApi.listDocuments(project.id),
      enabled: projects.length > 0,
    })),
  });

  const summaries = useMemo(() => (
    projects.map((project, index) =>
      buildProjectWorkspaceSummary(project, documentQueries[index]?.data?.documents || [])
    )
  ), [documentQueries, projects]);

  const allDocuments = summaries.flatMap((summary) =>
    summary.documents.map((document) => ({ document, project: summary.project }))
  );
  const recentDocuments = [...allDocuments]
    .sort((left, right) => new Date(right.document.last_activity_at).getTime() - new Date(left.document.last_activity_at).getTime())
    .slice(0, 5);
  const recentProjects = [...summaries]
    .sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime())
    .slice(0, 5);
  const reviewDocuments = allDocuments
    .filter(({ document }) => document.status.toLowerCase().includes('needs') || document.status.toLowerCase().includes('review'))
    .slice(0, 5);
  const draftDocuments = allDocuments
    .filter(({ document }) => document.status.toLowerCase().includes('draft') || document.progress.pct < 100)
    .slice(0, 5);
  const staleDocuments = allDocuments
    .filter(({ document }) => document.freshness.toLowerCase().includes('stale') || document.status.toLowerCase().includes('stale'))
    .slice(0, 5);
  const kpis = [
    { label: 'Projects', value: summaries.length },
    { label: 'Documents', value: allDocuments.length },
    { label: 'Needs review', value: reviewDocuments.length },
    { label: 'Source changed', value: staleDocuments.length },
  ];

  const filteredLibrary = filterProjectSummaries(
    summaries,
    libraryFilter,
    getRecentProjects(),
    searchQuery
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FolderClock className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h1 className="text-title font-semibold text-text-primary">Home</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/projects')}>
              <FolderKanban className="h-4 w-4" />
              Projects
            </Button>
            <Button type="button" onClick={() => navigate('/new-project')}>
              <PenLine className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-md border border-separator bg-panel-muted px-3 py-3">
              <p className="text-meta text-text-muted">{kpi.label}</p>
              <p className="mt-1 text-title font-semibold text-text-primary">{kpi.value}</p>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid gap-6 2xl:grid-cols-2">
        <WorkList
          title="Recent Documents"
          icon={FileText}
          items={recentDocuments.map(({ document, project }) => ({
            id: `recent-doc-${document.id}`,
            title: document.title,
            meta: `${project.name} · ${formatDate(document.last_activity_at)}`,
            badge: document.status,
            onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
          }))}
          empty="No Documents yet."
        />
        <WorkList
          title="Recent Projects"
          icon={FolderKanban}
          items={recentProjects.map((summary) => ({
            id: `recent-project-${summary.project.id}`,
            title: summary.project.name,
            meta: `${summary.documentCount} Documents · ${formatDate(summary.lastActivityAt)}`,
            badge: summary.project.freshness_state,
            onOpen: () => navigate(`/projects/${summary.project.id}`),
          }))}
          empty="No Projects yet."
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-3">
        <WorkList
          title="Needs Review"
          icon={TriangleAlert}
          items={reviewDocuments.map(({ document, project }) => ({
            id: `review-${document.id}`,
            title: document.title,
            meta: project.name,
            badge: document.status,
            onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
          }))}
          empty="Nothing needs review."
        />
        <WorkList
          title="Source Changed"
          icon={GitBranch}
          items={staleDocuments.map(({ document, project }) => ({
            id: `stale-${document.id}`,
            title: document.title,
            meta: project.name,
            badge: 'Source changed',
            onOpen: () => navigate(`/projects/${project.id}`),
          }))}
          empty="No source changes."
        />
        <WorkList
          title="Drafts In Progress"
          icon={PenLine}
          items={draftDocuments.map(({ document, project }) => ({
            id: `draft-${document.id}`,
            title: document.title,
            meta: `${project.name} · ${document.progress.pct}% reviewed`,
            badge: document.status,
            onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
          }))}
          empty="No draft Documents."
        />
      </div>

      <Surface variant="panel" padding="lg" className="space-y-3">
        <h2 className="text-section font-semibold text-text-primary">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate('/new-project')}>
            New Project
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/templates')}>
            Templates
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/settings?tab=ai-providers')}>
            AI providers
          </Button>
        </div>
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <h2 className="text-section font-semibold text-text-primary">Project library</h2>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative w-full min-w-0 xl:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                aria-label="Search project library"
                className="pl-9"
                placeholder="Search Projects, Templates, or tags"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <SegmentedControl
              label="Project library filter"
              value={libraryFilter}
              onValueChange={(value) => setLibraryFilter(value as 'all' | 'active' | 'stale' | 'resume')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'stale', label: 'Changed' },
                { value: 'resume', label: 'Recent' },
              ]}
            />
          </div>
        </div>
      </Surface>

      <ProjectLibrary
        summaries={filteredLibrary}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode('home-projects', value as 'list' | 'grid')}
        onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
        onCreateProject={() => navigate('/new-project')}
        emptyTitle="No Projects found"
        emptyDescription={searchQuery ? 'No Projects match the current search or filter.' : 'Create a Project to start.'}
      />
    </div>
  );
}

function WorkList({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  icon: typeof FileText;
  items: Array<{
    id: string;
    title: string;
    meta: string;
    badge?: string;
    onOpen: () => void;
  }>;
  empty: string;
}) {
  return (
    <Surface variant="panel" padding="lg" className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        <h2 className="text-section font-semibold text-text-primary">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-body text-text-muted">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onOpen}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-panel-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-body font-medium text-text-primary">{item.title}</span>
                <span className="block truncate text-meta text-text-muted">{item.meta}</span>
              </span>
              {item.badge && <Badge variant="neutral" showIcon={false}>{item.badge}</Badge>}
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
