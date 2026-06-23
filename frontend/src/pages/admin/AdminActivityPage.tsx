import { useEffect, useMemo, useState } from 'react';
import { Calendar, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { AdminActivityEvent } from '@/api/admin';

const DAYS_PRESETS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const eventTypeMap: Record<string, string> = {
  project_created: 'Project Created',
  document_created: 'Document Created',
  section_generated: 'AI Generated',
  section_refined: 'AI Refined',
  section_updated: 'Section Updated',
  review_accepted: 'Review Accepted',
  analysis_complete: 'Analysis Complete',
  source_synced: 'Source Synced',
  source_sync_completed: 'Sync Completed',
  member_invited: 'Member Invited',
  member_joined: 'Member Joined',
};

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function AdminActivityPage() {
  const [events, setEvents] = useState<AdminActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventTypes, setEventTypes] = useState<{ event_type: string; count: number }[]>([]);
  const [filterType, setFilterType] = useState('');
  const [days, setDays] = useState(30);
  const [sortDesc, setSortDesc] = useState(true);
  const [loading, setLoading] = useState(true);
  const pageSize = 200;

  const fetchActivity = () => {
    setLoading(true);
    Promise.all([
      adminApi.getActivity({ page, page_size: pageSize, event_type: filterType || undefined, days }),
      adminApi.getEventTypes(),
    ])
      .then(([activityRes, typesRes]) => {
        setEvents(activityRes.events);
        setTotal(activityRes.total);
        setEventTypes(typesRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchActivity(); }, [page, filterType, days]);

  const sortedEvents = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [events, sortDesc]);

  const dailyActivity = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const day = e.created_at.slice(0, 10);
      map.set(day, (map.get(day) || 0) + 1);
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([date, count]) => ({ date, count }));
  }, [events]);

  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      map.set(e.event_type, (map.get(e.event_type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([event_type, count]) => ({ event_type, count, label: eventTypeMap[event_type] || event_type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [events]);

  const groupedFeed = useMemo(() => {
    const groups = new Map<string, AdminActivityEvent[]>();
    for (const e of sortedEvents) {
      const day = e.created_at.slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return Array.from(groups.entries());
  }, [sortedEvents]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDaysChange = (value: number) => {
    setDays(value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Activity</h1>
          <p className="text-xs text-text-muted">Events across all organizations</p>
        </div>
        <Badge variant="neutral" showIcon={false}>
          {total} events
        </Badge>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-1">
          {DAYS_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={days === preset.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleDaysChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Event type filter */}
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="appearance-none rounded-lg border border-border bg-panel py-2 pl-10 pr-8 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">All events</option>
            {eventTypes.map((t) => (
              <option key={t.event_type} value={t.event_type}>
                {eventTypeMap[t.event_type] || t.event_type} ({t.count})
              </option>
            ))}
          </select>
        </div>

        {/* Sort toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortDesc((v) => !v)}
          className="gap-1"
        >
          <ArrowUpDown size={14} />
          {sortDesc ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time-series chart */}
        <Surface padding="default">
          <h2 className="mb-3 text-sm font-medium text-text-primary">Events per Day</h2>
          {dailyActivity.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-muted">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--overlay)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Surface>

        {/* Event type distribution */}
        <Surface padding="default">
          <h2 className="mb-3 text-sm font-medium text-text-primary">Event Distribution</h2>
          {typeDistribution.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-muted">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeDistribution} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--overlay)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Surface>
      </div>

      {/* Activity feed */}
      <Surface padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-muted">Loading...</div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-muted">No activity found</div>
        ) : (
          <div>
            {groupedFeed.map(([date, dayEvents]) => (
              <div key={date}>
                <div className="flex items-center gap-2 border-b border-border bg-panel-muted px-4 py-2">
                  <Calendar size={12} className="text-text-muted" />
                  <span className="text-xs font-medium text-text-muted">{formatDateLabel(date)}</span>
                  <span className="text-xs text-text-muted">— {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                </div>
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-border last:border-0 px-4 py-2.5 hover:bg-panel-muted/40"
                  >
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-chart-1/50" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">
                        {eventTypeMap[event.event_type] || event.event_type}
                        {event.message && event.message !== event.event_type && (
                          <span className="ml-1 text-text-muted">— {event.message}</span>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0 text-xs text-text-muted">
                        {event.user_name && <span>{event.user_name}</span>}
                        {event.project_name && <span>in {event.project_name}</span>}
                        {event.organization_name && <span>({event.organization_name})</span>}
                        <span className="text-text-muted/60">{new Date(event.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
