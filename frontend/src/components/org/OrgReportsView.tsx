import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { useHasCapability } from '@/hooks/useHasCapability';
import { useExportReport } from '@/hooks/useExport';
import { ORG_AUDIT } from '@/lib/authz';
import { orgApi } from '@/api/org';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/DashboardViews';
import { Download, FileBarChart, Loader2 } from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const DAYS_PRESETS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
];

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export const OrgReportsView: React.FC = () => {
  const { activeOrgId, organizations } = useOrgStore();
  const activeOrg = organizations.find((org) => org.id === activeOrgId);
  const canViewReports = useHasCapability(ORG_AUDIT);
  const [days, setDays] = useState(30);
  const { exportReport, loading: exporting } = useExportReport();

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['org-report', activeOrgId, days],
    queryFn: () => (activeOrgId ? orgApi.getReportSummary(activeOrgId, days) : Promise.reject('No active org')),
    enabled: !!activeOrgId && canViewReports,
  });

  if (!canViewReports) {
    return <div className="p-6 text-muted-foreground">Your role does not allow viewing reports.</div>;
  }
  if (!activeOrgId) return <div className="p-6 text-muted-foreground">No organization selected</div>;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (isError || !report) return <div className="p-6 text-destructive">Error loading report.</div>;

  const hasActivity = report.summary.total_actions > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-section font-semibold">Activity Report</h2>
          <p className="mt-1 text-body text-text-secondary">
            High-level summary of organization activity for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {DAYS_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={days === preset.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDays(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={exporting}
            onClick={() => exportReport(activeOrgId, days, activeOrg?.name)}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PDF
          </Button>
        </div>
      </div>

      {!hasActivity ? (
        <EmptyState
          title="No activity in this range"
          description="There is no recorded activity for this organization in the selected period."
          actionLabel="View last 90 days"
          onAction={() => setDays(90)}
          icon={FileBarChart}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total actions" value={report.summary.total_actions} />
            <StatCard label="Active users" value={report.summary.active_users} />
            <StatCard label="Most active project" value={report.summary.most_active_project || '—'} />
            <StatCard label="Top category" value={report.summary.top_action || '—'} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Surface padding="default">
              <h3 className="mb-3 text-sm font-medium text-text-primary">Activity trend</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.trend} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--separator)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--overlay)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            <Surface padding="default">
              <h3 className="mb-3 text-sm font-medium text-text-primary">Activity by category</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={report.categories} dataKey="count" nameKey="category" outerRadius={80} label>
                      {report.categories.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--overlay)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Surface>
          </div>

          <Surface padding="default">
            <h3 className="mb-3 text-sm font-medium text-text-primary">Top contributors</h3>
            {report.contributors.length === 0 ? (
              <p className="text-sm text-text-muted">No attributable user actions in this range.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-text-muted">
                    <th className="pb-2">User</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.contributors.map((c) => (
                    <tr key={c.user_id} className="border-t border-separator">
                      <td className="py-2 text-text-primary">{c.name || c.email}</td>
                      <td className="py-2 text-text-secondary">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Surface>

          <Surface padding="default">
            <h3 className="mb-3 text-sm font-medium text-text-primary">Notable events</h3>
            {report.events.length === 0 ? (
              <p className="text-sm text-text-muted">No activity recorded in this range.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-separator">
                {report.events.map((event, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-text-primary">{event.action}</p>
                      <p className="truncate text-xs text-text-muted">
                        {event.user_name || 'System'}{event.resource ? ` · ${event.resource}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-text-muted">
                      {new Date(event.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Surface padding="default">
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-text-muted">{label}</div>
    </Surface>
  );
}
