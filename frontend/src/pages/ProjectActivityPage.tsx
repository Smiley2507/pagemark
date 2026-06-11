import { useState, type ElementType } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, BookOpen, Check, Code, FileText, GitCommit, Layers, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { projectsApi, type ActivityEvent, type ActivityChartDay } from '@/api/projects';

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

const RANGE_OPTIONS = [7, 14, 30, 90, 180, 365] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Source: '#3B82F6',
  Documents: '#22C55E',
  Generation: '#A855F7',
  Review: '#F59E0B',
  Sharing: '#14B8A6',
  Project: '#6B7280',
};

const CATEGORY_ORDER = ['Source', 'Documents', 'Generation', 'Review', 'Sharing', 'Project'];

function allCategories(data: ActivityChartDay[]): string[] {
  const seen = new Set<string>();
  for (const day of data) {
    for (const cat of Object.keys(day.categories)) {
      seen.add(cat);
    }
  }
  return CATEGORY_ORDER.filter((c) => seen.has(c));
}

export function ProjectActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedDays, setSelectedDays] = useState<number>(14);

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => projectsApi.getActivity(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey: ['activity-heatmap', projectId, selectedDays],
    queryFn: () => projectsApi.getActivityHeatmap(Number(projectId), selectedDays),
    enabled: !!projectId,
  });

  if (activityLoading && chartLoading) {
    return (
      <Surface variant="muted" padding="lg">
        <p className="text-body text-text-secondary">Loading activity...</p>
      </Surface>
    );
  }

  const activities = activityData?.events || [];
  const categories = allCategories(chartData);
  const totalEvents = activities.length;
  const totalActivity = chartData.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="space-y-5">
      <Surface variant="panel" padding="lg" className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            <h2 className="text-section font-semibold text-text-primary">Activity</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" showIcon={false}>{totalEvents} events</Badge>
            <Badge variant="neutral" showIcon={false}>{totalActivity.toFixed(1)} weighted</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {RANGE_OPTIONS.map((days) => (
            <Button
              key={days}
              variant={selectedDays === days ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSelectedDays(days)}
            >
              {days}d
            </Button>
          ))}
        </div>

        {chartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--separator)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={{ stroke: 'var(--separator)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'var(--interaction-muted)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="square"
                  iconSize={10}
                />
                {categories.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={`categories.${cat}`}
                    name={cat}
                    stackId="stack"
                    fill={CATEGORY_COLORS[cat] || '#6B7280'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-body text-text-muted py-8 text-center">No activity in this period.</p>
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

function CategoryTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="rounded-lg border border-separator bg-panel px-3 py-2 shadow-sm">
      <p className="text-meta-sm font-medium text-text-primary">{label}</p>
      <p className="text-meta-sm text-text-muted">Total: {total.toFixed(1)}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-meta-sm text-text-secondary">
          {entry.name}: {entry.value.toFixed(1)}
        </p>
      ))}
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
