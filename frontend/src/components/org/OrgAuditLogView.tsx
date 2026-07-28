import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { useHasCapability } from '@/hooks/useHasCapability';
import { ORG_AUDIT } from '@/lib/authz';
import { orgApi } from '@/api/org';
import type { AuditLog } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ArrowDownUp, Search, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/DashboardViews';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const OrgAuditLogView: React.FC = () => {
  const { activeOrgId } = useOrgStore();
  const canViewAudit = useHasCapability(ORG_AUDIT);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'audit' | 'activity'>('all');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['org-audit-logs', activeOrgId, search, source, sort],
    queryFn: () => (activeOrgId
      ? orgApi.listAuditLogs(activeOrgId, 1, 300, {
        search: search.trim() || undefined,
        source,
        sort,
      })
      : Promise.reject('No active org')),
    enabled: !!activeOrgId && canViewAudit,
    refetchInterval: 10000,
  });

  const actionOptions = useMemo(
    () => Array.from(new Set((logs || []).map((log) => log.action))).sort(),
    [logs],
  );

  const chartData = useMemo(() => buildChartData(logs || []), [logs]);

  if (!canViewAudit) {
    return <div className="p-6 text-muted-foreground">Your role does not allow viewing activity logs.</div>;
  }

  if (!activeOrgId) return <div className="p-6 text-muted-foreground">No organization selected</div>;
  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      <div className="grid gap-4">
        {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
  );
  if (isError) return <div className="p-6 text-destructive">Error loading activity logs.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-section font-semibold">Audit Console</h2>
          <p className="mt-1 text-body text-text-secondary">
            Organization audit and project activity in one live feed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search logs"
              className="h-8 w-48 rounded-md border border-input bg-canvas pl-7 pr-2 text-xs text-text-primary"
            />
          </div>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as typeof source)}
            className="h-8 rounded-md border border-input bg-canvas px-2 text-xs text-text-primary"
          >
            <option value="all">all sources</option>
            <option value="audit">audit only</option>
            <option value="activity">activity only</option>
          </select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setSort((value) => value === 'desc' ? 'asc' : 'desc')}>
            <ArrowDownUp className="h-3.5 w-3.5" />
            {sort === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
        </div>
      </div>

      {logs && logs.length > 0 ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-separator bg-panel p-4">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-text-primary">Events over time</h3>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--separator)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<AuditTooltip />} />
                  <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-separator bg-[#0f1419]">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-emerald-300" />
                live audit stream
              </span>
              <span>latest {logs.length} rows</span>
            </div>
            <div className="max-h-[34rem] overflow-y-auto">
              {logs.map((log) => (
                <LogLine key={`${log.source || 'audit'}-${log.id}`} log={log} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-separator bg-panel p-4">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-text-primary">Action types</h3>
            <div className="mt-3 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {actionOptions.map((action) => (
                <span key={action} className="rounded bg-panel-muted px-2 py-1 font-mono text-[11px] text-text-secondary">
                  {formatAction(action)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No activity logs found"
          description="There is no audit history for this organization yet."
          actionLabel="Refresh Log"
          onAction={() => refetch()}
          icon={Activity}
        />
      )}

    </div>
  );
};

function LogLine({ log }: { log: AuditLog }) {
  const source = log.source || 'audit';
  const actor = log.user_name || log.user_email || (source === 'activity' ? 'system' : 'unknown');
  return (
    <div className="border-b border-white/10 px-3 py-2 font-mono text-xs last:border-b-0">
      <div className="flex min-w-0 items-start gap-2">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <p className="min-w-0 flex-1 truncate text-slate-100">
          <span className="text-slate-500">[{formatTerminalDate(log.created_at)}]</span>
          {' '}
          <span className={source === 'audit' ? 'text-cyan-300' : 'text-amber-300'}>{source}</span>
          {' '}
          <span className="text-violet-300">{formatAction(log.action)}</span>
          {' '}
          <span>{log.resource || 'no-resource'}</span>
        </p>
      </div>
      <p className="mt-1 truncate pl-5 text-[11px] text-slate-500">{actor}</p>
    </div>
  );
}

function buildChartData(logs: AuditLog[]) {
  const buckets = new Map<string, number>();
  [...logs].reverse().forEach((log) => {
    const date = new Date(log.created_at);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count,
  }));
}

function AuditTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-separator bg-panel px-3 py-2 shadow-sm">
      <p className="text-meta-sm font-medium text-text-primary">{label}</p>
      <p className="text-meta-sm text-text-muted">{payload[0].value} events</p>
    </div>
  );
}

function formatTerminalDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
