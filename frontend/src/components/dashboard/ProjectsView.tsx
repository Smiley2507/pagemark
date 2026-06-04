import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ProjectCard } from './ProjectCard';
import { SearchBar } from './SearchBar';
import { useProjects, useDeleteProject, useDuplicateProject, useStarProject } from '@/hooks/useProjects';
import { ErrorBanner, EmptyState } from './DashboardViews';

export const ProjectsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'starred' | 'recent'>('all');
  const { setQualityProjectId } = useOutletContext<{ setQualityProjectId: (id: number | null) => void }>();
  const tagFilter = searchParams.get('tag') || undefined;

  const {
    data: projectsList,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects({
    search: search || undefined,
    starred: projectFilter === 'starred' ? true : undefined,
    tag: tagFilter,
  });

  const deleteProjectMutation = useDeleteProject();
  const duplicateProjectMutation = useDuplicateProject();
  const starProjectMutation = useStarProject();

  const projects = useMemo(() => {
    if (!projectsList) return [];
    if (projectFilter === 'recent') {
      return [...projectsList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
    return projectsList;
  }, [projectsList, projectFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar onSearch={setSearch} />
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(['all', 'starred', 'recent'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setProjectFilter(filter)}
                className={cn(
                  'rounded-md px-3 py-1 text-meta-sm font-medium capitalize',
                  projectFilter === filter
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => navigate('/new-project')}>
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>
      </div>

      {projectsError && (
        <ErrorBanner
          message="Failed to load projects"
          onRetry={() => refetchProjects()}
        />
      )}

      {projectsLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      )}

      {!projectsLoading && !projectsError && projects.length === 0 && (
        <EmptyState
          title="No projects found"
          description={
            search
              ? 'No projects match your search.'
              : 'Create documentation from your codebase.'
          }
          actionLabel="Create project"
          onAction={() => navigate('/new-project')}
        />
      )}

      {!projectsLoading && !projectsError && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {projects.map((proj) => (
            <ProjectCard
              key={proj.id}
              project={proj}
              onOpen={(id) => navigate(`/editor/${id}`)}
              onDelete={(id) => {
                if (window.confirm('Delete this project?')) {
                  deleteProjectMutation.mutate(id);
                }
              }}
              onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
              onStar={(id, starred) => starProjectMutation.mutate({ id, starred })}
              onQuality={(id) => setQualityProjectId(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
