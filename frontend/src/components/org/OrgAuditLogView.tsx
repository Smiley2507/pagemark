import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import type { AuditLog } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/dashboard/DashboardViews';

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
      <h2 className="text-section font-semibold">Activity Log</h2>

      {logs && logs.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr className="divide-x divide-border">
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      {log.action}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {log.user_name || 'Unknown User'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.resource || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table >
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
      </div >
    </div >
  );
};
