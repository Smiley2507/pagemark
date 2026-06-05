import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Search } from 'lucide-react';
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
  type ProjectLibraryFilter,
} from '@/components/workspace/project-library';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProjectLibraryFilter>('all');
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

  const filtered = filterProjectSummaries(
    summaries,
    filter,
    getRecentProjects(),
    searchQuery
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex items-start gap-3">
          <FolderKanban className="mt-0.5 h-5 w-5 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-title font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-body text-text-secondary">
              Scan the Project library by purpose, freshness, and active work signals.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              aria-label="Search projects"
              className="pl-9"
              placeholder="Search Projects, Templates, or tags"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <SegmentedControl
            label="Project library filter"
            value={filter}
            onValueChange={(value) => setFilter(value as ProjectLibraryFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'stale', label: 'Source changes' },
              { value: 'resume', label: 'Recent' },
            ]}
          />
        </div>
      </Surface>

      <ProjectLibrary
        summaries={filtered}
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
