import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Activity, Braces, ChevronLeft, FileText, GitBranch, Pencil, Settings, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { documentsApi } from '@/api/documents';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { buildProjectWorkspaceSummary } from '@/components/workspace/project-library';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '', label: 'Documents', icon: FileText },
  { path: 'source', label: 'Source', icon: GitBranch },
  { path: 'analysis', label: 'Analysis', icon: Braces },
  { path: 'activity', label: 'Activity', icon: Activity },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recordRecentWork = useViewPreferenceStore((state) => state.recordRecentWork);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setDraftName(project.name);
      setDraftDescription(project.description || '');
    }
  }, [project]);

  const updateProject = useMutation({
    mutationFn: () => projectsApi.updateProject(Number(projectId), {
      name: draftName.trim(),
      description: draftDescription.trim(),
    }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
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
              {editing ? (
                <form
                  className="max-w-3xl space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (draftName.trim()) {
                      updateProject.mutate();
                    }
                  }}
                >
                  <Input
                    aria-label="Project name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                  <textarea
                    aria-label="Project description"
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-panel px-3 py-2 text-body text-text-primary transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!draftName.trim() || updateProject.isPending}>
                      Save Project
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(false);
                        setDraftName(project?.name || '');
                        setDraftDescription(project?.description || '');
                      }}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-title font-semibold text-text-primary">
                      {project?.name || 'Project workspace'}
                    </h1>
                    {project && (
                      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setEditing(true)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {project?.description && (
                    <p className="max-w-3xl text-body text-text-secondary">
                      {project.description}
                    </p>
                  )}
                </div>
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
