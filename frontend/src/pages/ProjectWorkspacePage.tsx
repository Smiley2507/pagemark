import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Activity, ChevronLeft, FileText, GitBranch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { documentsApi } from '@/api/documents';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { buildProjectWorkspaceSummary } from '@/components/workspace/project-library';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '', label: 'Documents', icon: FileText },
  { path: 'source', label: 'Source', icon: GitBranch },
  { path: 'activity', label: 'Activity', icon: Activity },
];

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const recordRecentWork = useViewPreferenceStore((state) => state.recordRecentWork);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: documentsResponse } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.listDocuments(Number(projectId)),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (projectId) {
      recordRecentWork({ projectId: Number(projectId) });
    }
  }, [projectId, recordRecentWork]);

  const summary = project
    ? buildProjectWorkspaceSummary(project, documentsResponse?.documents || [])
    : null;

  return (
    <div className="space-y-6 px-6 py-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-2"
              onClick={() => navigate('/projects')}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Projects
            </Button>
            <div>
              <h1 className="text-title font-semibold text-text-primary">
                {project?.name || 'Project workspace'}
              </h1>
              {project?.description && (
                <p className="mt-1 max-w-3xl text-body text-text-secondary">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" showIcon={false}>
                {summary.documentCount} Documents
              </Badge>
              {summary.activeGenerationCount > 0 && (
                <Badge variant="generation">
                  {summary.activeGenerationCount} generating
                </Badge>
              )}
              {summary.staleDocumentCount > 0 && (
                <Badge variant="warning">
                  {summary.staleDocumentCount} source changes
                </Badge>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Project workspace navigation" className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const destination = tab.path ? `/projects/${projectId}/${tab.path}` : `/projects/${projectId}`;

            return (
              <NavLink
                key={destination}
                to={destination}
                end={!tab.path}
                className={({ isActive }) => cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-interaction-muted text-text-primary'
                    : 'text-text-secondary hover:bg-panel-muted hover:text-text-primary'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </Surface>

      <Outlet />
    </div>
  );
}
