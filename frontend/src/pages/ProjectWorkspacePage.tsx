import React from 'react';
import { useParams, useNavigate, Outlet, NavLink } from 'react-router-dom';
import { FileText, GitBranch, Activity, ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });
  
  const tabs = [
    { path: '', label: 'Documents', icon: FileText },
    { path: 'source', label: 'Source', icon: GitBranch },
    { path: 'activity', label: 'Activity', icon: Activity },
  ];
  
  return (
    <div className="min-h-screen bg-workspace">
      {/* Project Header */}
      <div className="border-b border-separator bg-panel">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/home')}
              aria-label="Back to home"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-title font-semibold text-text-primary truncate">
                {project?.name || 'Loading...'}
              </h1>
              {project?.description && (
                <p className="text-body text-text-secondary truncate mt-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <nav className="flex gap-1 mt-4 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const path = tab.path ? `/projects/${projectId}/${tab.path}` : `/projects/${projectId}`;
              
              return (
                <NavLink
                  key={tab.path || 'documents'}
                  to={path}
                  end={!tab.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-4 py-2 rounded-t-md text-body font-medium transition-colors border-b-2',
                      isActive
                        ? 'text-interaction border-interaction bg-interaction-muted'
                        : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-panel-muted'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}
