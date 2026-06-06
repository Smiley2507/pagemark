import type { ElementType } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, BookOpen, Check, Code, FileText, GitCommit, Layers, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { projectsApi, type ActivityEvent } from '@/api/projects';

const EVENT_ICONS: Record<string, ElementType> = {
  source_sync: GitCommit,
  analysis_started: Code,
  analysis_complete: Code,
  analysis_failed: TriangleAlert,
  project_created: FileText,
  document_created: FileText,
  outline_approved: Layers,
  generation_run_started: BookOpen,
  generation_run_completed: BookOpen,
  generation_run_failed: TriangleAlert,
  section_reviewed: Check,
  freshness_detected: TriangleAlert,
};

const HEATMAP_CLASSES = [
  'bg-muted',
  'bg-interaction-muted',
  'bg-status-generation',
  'bg-interaction',
];

const HEATMAP_DAYS = 84;

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
        <p className="text-body text-text-secondary">Loading activity...</p>
      </Surface>
    );
  }

  const activities = activityData?.events || [];
  const heatmapDays = buildHeatmapDays(heatmapData || {}, HEATMAP_DAYS);
  const activeDays = heatmapDays.filter((day) => day.weight > 0).length;

  return (
    <div className="space-y-5">
      <Surface variant="panel" padding="lg" className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            <h2 className="text-section font-semibold text-text-primary">Activity</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" showIcon={false}>{activities.length} events</Badge>
            <Badge variant="neutral" showIcon={false}>{activeDays} active days</Badge>
          </div>
        </div>

        {activeDays === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Source, Analysis, generation, and review events will appear here."
          />
        ) : (
          <div className="overflow-x-auto pb-1">
            <div
              className="grid w-max grid-flow-col grid-rows-7 gap-1"
              role="list"
              aria-label="Activity heatmap for the last 12 weeks"
            >
              {heatmapDays.map(({ date, weight }) => (
                <div
                  key={date}
                  role="listitem"
                  title={`${formatHeatmapDate(date)}: ${formatWeight(weight)}`}
                  aria-label={`${formatHeatmapDate(date)}: ${formatWeight(weight)}`}
                  className={`h-3 w-3 rounded ${heatmapClass(weight)}`}
                />
              ))}
            </div>
          </div>
        )}
      </Surface>

      {activities.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Project events will appear here when work progresses."
        />
      ) : (
        <div className="divide-y divide-separator">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityEvent }) {
  const Icon = EVENT_ICONS[activity.event_type] || Activity;

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <p className="text-body text-text-primary">{activity.message}</p>
          <Badge variant="neutral" showIcon={false}>
            {formatEventType(activity.event_type)}
          </Badge>
        </div>
        <p className="mt-1 text-meta text-text-muted">
          {[activity.document_title, activity.section_heading].filter(Boolean).join(' · ') || 'Project'}
          {' · '}
          {formatTimelineDate(activity.created_at)}
        </p>
      </div>
    </div>
  );
}

function buildHeatmapDays(source: Record<string, number>, days: number) {
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setDate(start.getDate() - start.getDay());

  const entries: Array<{ date: string; weight: number }> = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateKey(cursor);
    entries.push({ date, weight: source[date] || 0 });
  }
  return entries;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHeatmapDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTimelineDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventType(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

function formatWeight(weight: number) {
  if (weight <= 0) return 'no activity';
  return `${weight.toFixed(1)} weighted activity`;
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
