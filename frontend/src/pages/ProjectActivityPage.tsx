import React from 'react';
import { useParams } from 'react-router-dom';
import { Activity, GitCommit, FileText, Check, AlertCircle, Code, Layers, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { projectsApi } from '@/api/projects';

const EVENT_ICONS: Record<string, React.ElementType> = {
  source_sync: GitCommit,
  analysis_complete: Code,
  analysis_failed: AlertCircle,
  document_created: FileText,
  outline_approved: Layers,
  generation_run_completed: BookOpen,
  section_reviewed: Check,
};

const EVENT_COLORS: Record<string, string> = {
  source_sync: 'bg-blue-100 text-blue-700',
  analysis_complete: 'bg-purple-100 text-purple-700',
  analysis_failed: 'bg-red-100 text-red-700',
  document_created: 'bg-green-100 text-green-700',
  outline_approved: 'bg-indigo-100 text-indigo-700',
  generation_run_completed: 'bg-teal-100 text-teal-700',
  section_reviewed: 'bg-emerald-100 text-emerald-700',
};

export function ProjectActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => projectsApi.getActivity(Number(projectId)),
    enabled: !!projectId,
  });
  
  const { data: heatmapData } = useQuery({
    queryKey: ['activity-heatmap', projectId],
    queryFn: () => projectsApi.getActivityHeatmap(Number(projectId)),
    enabled: !!projectId,
  });

  const activities = activityData?.events || [];
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">Loading activity...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Activity Heatmap */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Activity Overview</h2>
        {heatmapData && Object.keys(heatmapData).length > 0 ? (
          <div className="rounded-lg border border-separator bg-panel p-6">
            <div className="flex flex-wrap gap-1">
              {Object.entries(heatmapData).slice(-90).map(([date, count]) => (
                <div
                  key={date}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: count > 0
                      ? `rgba(59, 130, 246, ${Math.min(count / 10, 1)})`
                      : 'rgb(229, 231, 235)',
                  }}
                  title={`${date}: ${count.toFixed(1)} activity`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-separator bg-panel p-6">
            <div className="flex items-center gap-3 text-text-muted">
              <Activity className="h-5 w-5" />
              <span className="text-body">No activity data yet</span>
          </div>
        </div>
      </section>
      
      {/* Activity Timeline */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Recent Activity</h2>
        
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <ActivityItem key={activity.id} activity={activity} isLast={index === activities.length - 1} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ActivityItem({ activity, isLast }: {
  activity: { event_type: string; message: string; created_at: string; document_title?: string | null; section_heading?: string | null };
  isLast: boolean;
}) {
  const Icon = EVENT_ICONS[activity.event_type] || Activity;
  const colorClasses = EVENT_COLORS[activity.event_type] || 'bg-gray-100 text-gray-700';
  
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-separator mt-2" />}
      </div>
      
      <div className="flex-1 pb-6">
        <div className="rounded-lg border border-separator bg-panel p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-body text-text-primary">{activity.message}</p>
              <p className="text-meta text-text-muted mt-1">
                {new Date(activity.created_at).toLocaleString()}
              </p>
              {(activity.document_title || activity.section_heading) && (
                <div className="flex gap-2 mt-1">
                  {activity.document_title && (
                    <Badge variant="info" showIcon={false}>
                      {activity.document_title}
                    </Badge>
                  )}
                  {activity.section_heading && (
                    <Badge variant="neutral" showIcon={false}>
                      {activity.section_heading}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <Badge variant="neutral" showIcon={false}>
              {activity.event_type.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
