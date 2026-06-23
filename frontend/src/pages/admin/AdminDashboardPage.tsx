import { useEffect, useState } from 'react';
import {
  Users, Building2, FolderKanban, FileText, Activity, Shield,
  TrendingUp, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { SystemStats, GrowthDataPoint } from '@/api/admin';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [growth, setGrowth] = useState<GrowthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getStats(),
      adminApi.getGrowthData(30),
    ])
      .then(([statsData, growthData]) => {
        setStats(statsData);
        setGrowth(growthData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Failed to load dashboard data
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-chart-1' },
    { label: 'Organizations', value: stats.total_organizations, icon: Building2, color: 'text-chart-2' },
    { label: 'Projects', value: stats.total_projects, icon: FolderKanban, color: 'text-chart-3' },
    { label: 'Documents', value: stats.total_documents, icon: FileText, color: 'text-chart-4' },
    { label: 'Active (24h)', value: stats.active_users_last_24h, icon: Activity, color: 'text-chart-5' },
    { label: 'Active (7d)', value: stats.active_users_last_7d, icon: TrendingUp, color: 'text-chart-1' },
    { label: 'Active (30d)', value: stats.active_users_last_30d, icon: Clock, color: 'text-chart-2' },
    { label: 'Pending Requests', value: stats.pending_superuser_requests, icon: Shield, color: 'text-chart-3' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Surface key={card.label} padding="default">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-muted">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-text-primary">{card.value}</p>
              </div>
              <card.icon size={24} className={card.color} />
            </div>
          </Surface>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Growth Chart */}
        <Surface padding="default">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Growth (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                tickFormatter={(d) => d.slice(5, 10)}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="users" stackId="1" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} />
              <Area type="monotone" dataKey="organizations" stackId="1" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.2} />
              <Area type="monotone" dataKey="projects" stackId="1" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.2} />
              <Area type="monotone" dataKey="documents" stackId="1" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </Surface>

        {/* Activity Summary */}
        <Surface padding="default">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Activity Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-panel-muted px-3 py-2">
              <span className="text-sm text-text-muted">Documents Generated</span>
              <span className="text-lg font-semibold text-text-primary">{stats.documents_generated}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-panel-muted px-3 py-2">
              <span className="text-sm text-text-muted">Active Users (24h)</span>
              <span className="text-lg font-semibold text-text-primary">{stats.active_users_last_24h}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-panel-muted px-3 py-2">
              <span className="text-sm text-text-muted">Pending Admin Requests</span>
              <span className="text-lg font-semibold text-text-primary">{stats.pending_superuser_requests}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-panel-muted px-3 py-2">
              <span className="text-sm text-text-muted">Total Users</span>
              <span className="text-lg font-semibold text-text-primary">{stats.total_users}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-panel-muted px-3 py-2">
              <span className="text-sm text-text-muted">Total Organizations</span>
              <span className="text-lg font-semibold text-text-primary">{stats.total_organizations}</span>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
