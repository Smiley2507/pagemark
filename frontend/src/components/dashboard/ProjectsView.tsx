import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus, LayoutDashboard, AlertCircle, CheckCircle2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ProjectCard } from './ProjectCard';
import { SearchBar } from './SearchBar';
import { useProjects, useDeleteProject, useDuplicateProject, useStarProject } from '@/hooks/useProjects';
import { ErrorBanner, EmptyState } from './DashboardViews';

function KpiCard({ icon: Icon, label, value, sub, bg, iconColor }: { icon: any; label: string; value: string | number; sub?: string; bg?: string; iconColor?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <div className={cn("rounded-full p-2.5", bg ?? "bg-primary/10")}>
        <Icon className={cn("h-5 w-5", iconColor ?? "text-primary")} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export const ProjectsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | undefined>(searchParams.get('tag') || undefined);
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const { setQualityProjectId } = useOutletContext<{ setQualityProjectId: (id: number | null) => void }>();

  const {
    data: projectsList,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects({ search: search || undefined, tag: tagFilter });

  const deleteProjectMutation = useDeleteProject();
  const duplicateProjectMutation = useDuplicateProject();
  const starProjectMutation = useStarProject();

  const projects = useMemo(() => {
    if (!projectsList) return [];
    let list = [...projectsList];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return list;
  }, [projectsList, search, sortBy]);

  const totalProjects = projectsList?.length ?? 0;
  const avgCompletion = projectsList && projectsList.length > 0
    ? Math.round(projectsList.reduce((sum, p) => sum + (p.completion_pct || 0), 0) / projectsList.length)
    : 0;
  const draftCount = projectsList?.filter(p => p.status === 'draft').length ?? 0;
  const finalizedCount = projectsList?.filter(p => p.status === 'finalized').length ?? 0;
  const needsAttentionCount = projectsList?.filter(p => p.completion_pct < 25 && p.status !== 'finalized').length ?? 0;

  const renderProjectGrid = (items: typeof projects) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
      {items.map((proj) => (
        <ProjectCard
          key={proj.id}
          project={proj}
          onOpen={(id) => navigate(`/editor/${id}`)}
          onDelete={(id) => { if (window.confirm('Delete this project?')) deleteProjectMutation.mutate(id); }}
          onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
          onStar={(id, starred) => starProjectMutation.mutate({ id, starred })}
          onQuality={(id) => setQualityProjectId(id)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      {!projectsLoading && !projectsError && projectsList && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={LayoutDashboard} label="Total Projects" value={totalProjects} sub={`${draftCount} draft · ${finalizedCount} finalized`} />
          <KpiCard icon={Target} label="Avg Completion" value={`${avgCompletion}%`} bg="bg-success/10" iconColor="text-success" />
          <KpiCard icon={AlertCircle} label="Needs Attention" value={needsAttentionCount} bg="bg-warning/10" iconColor="text-warning" />
          <KpiCard icon={CheckCircle2} label="Finalized" value={finalizedCount} bg="bg-info/10" iconColor="text-info" />
        </div>
      )}

      {/* Search + Sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <SearchBar onSearch={setSearch} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground"
          >
            <option value="updated">Last updated</option>
            <option value="created">Last created</option>
            <option value="name">Name</option>
          </select>
        </div>
        <Button onClick={() => navigate('/new-project')}>
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>
      </div>

      {projectsError && (
        <ErrorBanner message="Failed to load projects" onRetry={() => refetchProjects()} />
      )}

      {projectsLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      )}

      {!projectsLoading && !projectsError && projects.length === 0 && (
        <EmptyState
          title="No projects found"
          description={search ? 'No projects match your search.' : 'Create documentation from your codebase.'}
          actionLabel="Create project"
          onAction={() => navigate('/new-project')}
        />
      )}

      {!projectsLoading && !projectsError && projects.length > 0 && (
        renderProjectGrid(projects)
      )}
    </div>
  );
};
