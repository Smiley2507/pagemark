import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import type { AuditLog } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/DashboardViews';

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const OrgAuditLogView: React.FC = () => {
  const { activeOrgId } = useOrgStore();
  const [page, setPage] = useState(1);

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['org-audit-logs', activeOrgId, page],
    queryFn: () => (activeOrgId ? orgApi.listAuditLogs(activeOrgId, page) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

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
      <h2 className="text-section font-semibold">Audit Log</h2>

      {logs && logs.length > 0 ? (
        <div className="border-2 border-double border-border bg-card rounded-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-double border-border bg-panel-muted/80">
                <th className="px-3 py-2.5 text-meta-sm font-mono uppercase tracking-widest text-text-muted">Action</th>
                <th className="px-3 py-2.5 text-meta-sm font-mono uppercase tracking-widest text-text-muted">User</th>
                <th className="px-3 py-2.5 text-meta-sm font-mono uppercase tracking-widest text-text-muted">Resource</th>
                <th className="px-3 py-2.5 text-meta-sm font-mono uppercase tracking-widest text-text-muted">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="even:bg-panel-muted/20 hover:bg-interaction-muted/10 transition-colors border-b border-separator/40 last:border-b-0"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-panel-muted/60 px-2 py-0.5 font-mono text-meta font-medium text-text-secondary tracking-tight">
                        <Activity className="h-3 w-3 text-text-muted shrink-0" />
                        {formatAction(log.action)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-meta text-text-secondary">
                      <User className="h-3 w-3 text-text-muted shrink-0" />
                      <span className="truncate max-w-[140px]">{log.user_name || 'Unknown User'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-meta text-text-muted">
                    <span className="truncate max-w-[200px] inline-block align-middle leading-none">
                      {log.resource || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-meta text-text-muted whitespace-nowrap">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-meta text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!logs || logs.length < 50}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
