import React from 'react';
import { useParams } from 'react-router-dom';
import { GitBranch, RefreshCw, FileCode2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';

export function ProjectSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();
  
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });
  
  const { data: analysisStatus } = useQuery({
    queryKey: ['analysis-status', projectId],
    queryFn: () => analysisApi.getAnalysisStatus(Number(projectId)),
    enabled: !!projectId,
  });
  
  return (
    <div className="space-y-8">
      {/* Repository Metadata */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Repository</h2>
        
        <div className="rounded-lg border border-separator bg-panel p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-text-secondary" />
                <div>
                  <div className="text-body font-medium text-text-primary">
                    {project?.git_repo_url || 'No source connected'}
                  </div>
                  {project?.git_branch && (
                    <div className="text-meta text-text-muted mt-1">
                      Branch: {project.git_branch}
                    </div>
                  )}
                </div>
              </div>
              
              {project?.source_type && (
                <div className="flex items-center gap-2">
                  <span className="text-meta text-text-muted">Source Type:</span>
                  <Badge variant="neutral" showIcon={false}>{project.source_type}</Badge>
                </div>
              )}
            </div>
            
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
          </div>
        </div>
      </section>
      
      {/* Analysis Snapshots */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Analysis</h2>
        
        {analysisStatus ? (
          <div className="rounded-lg border border-separator bg-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode2 className="h-5 w-5 text-text-secondary" />
                <div>
                  <div className="text-body font-medium text-text-primary">
                    {analysisStatus.status === 'completed' ? 'Analysis Complete' : `Analysis ${analysisStatus.status}`}
                  </div>
                  {analysisStatus.completed_at && (
                    <div className="text-meta text-text-muted mt-1">
                      Last updated: {new Date(analysisStatus.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              
              <Badge 
                variant={
                  analysisStatus.status === 'completed' ? 'success' : 
                  analysisStatus.status === 'failed' ? 'danger' : 
                  'info'
                }
              >
                {analysisStatus.status}
              </Badge>
            </div>
            
            {analysisStatus.steps && (
              <div className="space-y-2 pt-4 border-t border-separator">
                <div className="text-body font-medium text-text-primary">Analysis Steps</div>
                <div className="grid gap-2">
                  {analysisStatus.steps.map((step) => (
                    <div key={step.number} className="flex items-center justify-between text-body text-text-secondary">
                      <span>{step.name}</span>
                      <Badge 
                        variant={
                          step.status === 'done' ? 'success' : 
                          step.status === 'failed' ? 'danger' : 
                          step.status === 'running' ? 'info' :
                          'neutral'
                        }
                        showIcon={false}
                      >
                        {step.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-separator bg-panel p-12 text-center">
            <AlertCircle className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <p className="text-body text-text-secondary">No analysis available</p>
          </div>
        )}
      </section>
    </div>
  );
}
