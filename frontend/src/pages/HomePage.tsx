import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Grid3x3, List, Clock, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { projectsApi } from '@/api/projects';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import type { Project } from '@/types';

export function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const viewMode = useViewPreferenceStore((s) => s.getViewMode('home-projects'));
  const setViewMode = useViewPreferenceStore((s) => s.setViewMode);
  const getRecentProjects = useViewPreferenceStore((s) => s.getRecentProjects);
  
  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({}),
  });
  
  const recentProjectIds = getRecentProjects();
  const recentProjects = allProjects.filter((p) => recentProjectIds.includes(p.id));
  const activeProjects = allProjects.filter((p) => p.status === 'draft');
  
  const filteredProjects = allProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleCreateProject = () => {
    navigate('/document-setup');
  };
  
  return (
    <div className="min-h-screen bg-workspace">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title font-semibold text-text-primary">Projects</h1>
            <p className="text-body text-text-secondary mt-1">
              Create and manage your documentation projects
            </p>
          </div>
          <Button onClick={handleCreateProject} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
        
        {/* Recent & Active Projects */}
        {recentProjects.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-text-secondary" />
              <h2 className="text-section font-semibold text-text-primary">Recent</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentProjects.slice(0, 3).map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
              ))}
            </div>
          </section>
        )}
        
        {activeProjects.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-text-secondary" />
              <h2 className="text-section font-semibold text-text-primary">Active</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.slice(0, 3).map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
              ))}
            </div>
          </section>
        )}
        
        {/* All Projects Library */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-section font-semibold text-text-primary">All Projects</h2>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex rounded-md border border-separator bg-panel">
                <button
                  onClick={() => setViewMode('home-projects', 'list')}
                  className={cn(
                    'p-2 rounded-l-md transition-colors',
                    viewMode === 'list' ? 'bg-interaction-muted text-interaction' : 'text-text-muted hover:text-text-primary'
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('home-projects', 'grid')}
                  className={cn(
                    'p-2 rounded-r-md transition-colors',
                    viewMode === 'grid' ? 'bg-interaction-muted text-interaction' : 'text-text-muted hover:text-text-primary'
                  )}
                  aria-label="Grid view"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-12 text-text-muted">Loading projects...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-body text-text-muted">
                {searchQuery ? 'No projects found matching your search.' : 'No projects yet. Create your first project to get started.'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-2">
              {filteredProjects.map((project) => (
                <ProjectListItem key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-separator bg-panel p-4 transition-all hover:border-interaction hover:shadow-sm"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-body-lg font-semibold text-text-primary line-clamp-1">
            {project.name}
          </h3>
          <Badge variant={project.status === 'finalized' ? 'success' : project.status === 'draft' ? 'warning' : 'neutral'}>
            {project.status}
          </Badge>
        </div>
        
        {project.description && (
          <p className="text-body text-text-secondary line-clamp-2">{project.description}</p>
        )}
        
        <div className="flex items-center justify-between text-meta text-text-muted">
          <span>{project.completion_pct}% complete</span>
          <span>{new Date(project.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </button>
  );
}

function ProjectListItem({ project, onClick }: ProjectCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-separator bg-panel p-4 transition-all hover:border-interaction"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-semibold text-text-primary truncate">{project.name}</h3>
          {project.description && (
            <p className="text-body text-text-secondary truncate mt-1">{project.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <Badge variant={project.status === 'finalized' ? 'success' : project.status === 'draft' ? 'warning' : 'neutral'}>
            {project.status}
          </Badge>
          <span className="text-meta text-text-muted w-20 text-right">
            {project.completion_pct}%
          </span>
          <span className="text-meta text-text-muted w-24 text-right">
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </button>
  );
}
