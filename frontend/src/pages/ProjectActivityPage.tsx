import { useParams } from 'react-router-dom';
import { Activity, BookOpen, Check, Code, FileText, GitCommit, Layers, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';

const EVENT_ICONS: Record<string, React.ElementType> = {
  source_sync: GitCommit,
  analysis_complete: Code,
  analysis_failed: TriangleAlert,
  document_created: FileText,
  outline_approved: Layers,
  generation_run_completed: BookOpen,
  section_reviewed: Check,
};

const HEATMAP_CLASSES = [
  'bg-panel-muted',
  'bg-interaction-muted',
  'bg-status-generation',
  'bg-interaction',
];

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

  if (isLoading) {
    return (
      <Surface variant="muted" padding="lg">
        <p className="text-body text-text-secondary">Loading Activity…</p>
      </Surface>
    );
  }

  const activities = activityData?.events || [];
  const heatmapEntries = Object.entries(heatmapData || {}).slice(-84);

  return (
    <div className="space-y-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Project Activity</p>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Meaningful workflow history</h2>
            </div>
          </div>
          <Badge variant="neutral">No autosave noise</Badge>
        </div>
        <p className="text-body text-text-secondary">
          Meaningful workflow events across source sync, Analysis, generation, review, and freshness changes.
        </p>
        <Notice variant="info" title="Governed event stream">
          Routine autosaves and granular edit churn stay out of this feed so review and source-health signals remain easy to scan.
        </Notice>

        {heatmapEntries.length === 0 ? (
          <EmptyState
            title="No Activity yet"
            description="Meaningful Project events will appear after source sync, generation, and review."
          />
        ) : (
          <div className="flex flex-wrap gap-1" aria-label="Activity heatmap">
            {heatmapEntries.map(([date, weight]) => (
              <div
                key={date}
                title={`${date}: ${weight.toFixed(1)} weighted activity`}
                className={`h-3 w-3 rounded-sm ${heatmapClass(weight)}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </Surface>

      {activities.length === 0 ? (
        <EmptyState
          title="No recent Activity"
          description="Project events will appear here when work progresses."
        />
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
}: {
  activity: {
    event_type: string;
    message: string;
    created_at: string;
    document_title?: string | null;
    section_heading?: string | null;
  };
}) {
  const Icon = EVENT_ICONS[activity.event_type] || Activity;

  return (
    <Surface variant="panel" padding="default" className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-panel-muted text-text-secondary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-body text-text-primary">{activity.message}</p>
            <p className="text-meta text-text-muted">
              {new Date(activity.created_at).toLocaleString()}
            </p>
          </div>
          <Badge variant="neutral" showIcon={false}>
            {activity.event_type.replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>
    </Surface>
  );
}

function heatmapClass(weight: number) {
  if (weight <= 0) {
    return HEATMAP_CLASSES[0];
  }
  if (weight < 2) {
    return HEATMAP_CLASSES[1];
  }
  if (weight < 5) {
    return HEATMAP_CLASSES[2];
  }
  return HEATMAP_CLASSES[3];
}
