import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { FolderClock, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { documentsApi } from '@/api/documents';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import {
  buildProjectWorkspaceSummary,
  filterProjectSummaries,
  ProjectLibrary,
  SignalList,
} from '@/components/workspace/project-library';

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'active' | 'stale' | 'resume'>('all');
  const viewMode = useViewPreferenceStore((state) => state.getViewMode('home-projects'));
  const setViewMode = useViewPreferenceStore((state) => state.setViewMode);
  const getRecentProjects = useViewPreferenceStore((state) => state.getRecentProjects);
  const recentWork = useViewPreferenceStore((state) => state.recentWork);

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

  const summariesById = useMemo(
    () => new Map(summaries.map((summary) => [summary.project.id, summary])),
    [summaries]
  );

  const resumeItems = recentWork
    .slice(0, 5)
    .map((entry) => {
      const summary = summariesById.get(entry.projectId);
      if (!summary) {
        return null;
      }
      const document = entry.documentId
        ? summary.documents.find((candidate) => candidate.id === entry.documentId)
        : undefined;
      return {
        id: `${entry.projectId}-${entry.documentId || 'project'}-${entry.sectionId || 'root'}`,
        title: summary.project.name,
        description: document ? `Resume ${document.title}` : 'Return to the Project workspace',
        meta: `Last opened ${new Date(entry.timestamp).toLocaleDateString()}`,
        badge: document ? { label: 'Resume', variant: 'review' as const } : undefined,
        onOpen: () => navigate(document ? `/projects/${entry.projectId}/documents/${document.id}` : `/projects/${entry.projectId}`),
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      title: string;
      description: string;
      meta: string;
      badge?: {
        label: string;
        variant: 'review';
      };
      onOpen: () => void;
    }>;

  const generationItems = summaries
    .flatMap((summary) =>
      summary.documents
        .filter((document) => document.status.toLowerCase().includes('generat'))
        .map((document) => ({
          id: `${summary.project.id}-${document.id}-generation`,
          title: summary.project.name,
          description: `Generating ${document.title}`,
          meta: `Template ${document.template?.name || 'Custom outline'}`,
          badge: { label: 'Generating', variant: 'generation' as const },
          onOpen: () => navigate(`/projects/${summary.project.id}/documents/${document.id}`),
        }))
    )
    .slice(0, 5);

  const staleItems = summaries
    .flatMap((summary) =>
      summary.documents
        .filter((document) => document.freshness.toLowerCase().includes('stale'))
        .map((document) => ({
          id: `${summary.project.id}-${document.id}-stale`,
          title: summary.project.name,
          description: `${document.title} may need freshness review`,
          meta: `Last activity ${new Date(document.last_activity_at).toLocaleDateString()}`,
          badge: { label: 'Source changes', variant: 'warning' as const },
          onOpen: () => navigate(`/projects/${summary.project.id}`),
        }))
    )
    .slice(0, 5);

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
            <p className="max-w-3xl text-body text-text-secondary">
              Resume recent Project work, monitor active generation, and keep Documents fresh without leaving the workspace.
            </p>
          </div>
          <Button type="button" onClick={() => navigate('/document-setup')}>
            New Project
          </Button>
        </div>
        <Notice variant="info" title="Workspace focus">
          Projects organize multiple Documents. Resume work starts here, then narrows into Documents, Source, and Activity after you enter a Project.
        </Notice>
      </Surface>

      <div className="grid gap-6 2xl:grid-cols-3">
        <SignalList
          title="Resume work"
          icon="resume"
          items={resumeItems}
          empty="Recent work will appear here after you open a Project or Document."
        />
        <SignalList
          title="Active generation"
          icon="generation"
          items={generationItems}
          empty="No Documents are generating right now."
        />
        <SignalList
          title="Source changes"
          icon="stale"
          items={staleItems}
          empty="No freshness signals need attention."
        />
      </div>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Project library</h2>
            </div>
            <p className="text-body text-text-secondary">
              Search across recent Projects, active generation, and the full library.
            </p>
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
                { value: 'stale', label: 'Source changes' },
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
        onCreateProject={() => navigate('/document-setup')}
        emptyTitle="No Projects found"
        emptyDescription={searchQuery ? 'No Projects match the current search or filter.' : 'Create a Project to start building Documents from source.'}
      />
    </div>
  );
}
