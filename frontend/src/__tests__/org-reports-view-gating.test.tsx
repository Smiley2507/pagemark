import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { OrgReportsView } from '@/components/org/OrgReportsView';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import type { OrgActivityReport } from '@/types';

vi.mock('@/api/org', () => ({
  orgApi: { getReportSummary: vi.fn() },
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
global.ResizeObserver = MockResizeObserver;

function setActiveOrg(role: 'ADMIN' | 'PROJECT_MANAGER' | 'VIEWER') {
  useOrgStore.setState({
    activeOrgId: 1,
    currentRole: role,
    organizations: [
      { id: 1, name: 'Test Org', slug: 'test-org', personal: false, created_at: '2026-01-01T00:00:00Z', quality_threshold: 70 } as any,
    ],
  });
}

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OrgReportsView />
    </QueryClientProvider>,
  );
}

const populatedReport: OrgActivityReport = {
  org_id: 1,
  org_name: 'Test Org',
  days: 30,
  range_label: 'Last 30 days',
  generated_at: '2026-08-12T00:00:00Z',
  summary: { total_actions: 8, active_users: 3, most_active_project: 'Docs', top_action: 'Documents' },
  trend: [{ date: '2026-08-11', label: 'Aug 11', count: 8 }],
  categories: [{ category: 'Documents', count: 8 }],
  contributors: [{ user_id: 1, name: 'Ada', email: 'ada@example.com', count: 4 }],
  events: [{ action: 'Document created', resource: 'project:1:Docs', user_name: 'Ada', created_at: '2026-08-11T00:00:00Z', source: 'audit' }],
};

const emptyReport: OrgActivityReport = {
  org_id: 1,
  org_name: 'Test Org',
  days: 30,
  range_label: 'Last 30 days',
  generated_at: '2026-08-12T00:00:00Z',
  summary: { total_actions: 0, active_users: 0 },
  trend: [{ date: '2026-08-11', label: 'Aug 11', count: 0 }],
  categories: [],
  contributors: [],
  events: [],
};

describe('OrgReportsView capability gating and rendering', () => {
  beforeEach(() => {
    useOrgStore.setState({ activeOrgId: null, currentRole: null, organizations: [] });
    vi.mocked(orgApi.getReportSummary).mockReset();
  });

  it('hides the report for a Viewer', async () => {
    setActiveOrg('VIEWER');
    renderWithQueryClient();

    expect(await screen.findByText(/your role does not allow viewing reports/i)).toBeInTheDocument();
    expect(orgApi.getReportSummary).not.toHaveBeenCalled();
  });

  it('shows the dashboard with summary data for a Project Manager', async () => {
    vi.mocked(orgApi.getReportSummary).mockResolvedValue(populatedReport);
    setActiveOrg('PROJECT_MANAGER');
    renderWithQueryClient();

    expect(await screen.findByText('Activity Report')).toBeInTheDocument();
    expect(await screen.findByText('5')).toBeInTheDocument(); // total actions stat
    expect(screen.getByText('Docs')).toBeInTheDocument(); // most active project
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
    expect(orgApi.getReportSummary).toHaveBeenCalledWith(1, 30);
  });

  it('shows an empty state when there is no activity in range', async () => {
    vi.mocked(orgApi.getReportSummary).mockResolvedValue(emptyReport);
    setActiveOrg('ADMIN');
    renderWithQueryClient();

    expect(await screen.findByText(/no activity in this range/i)).toBeInTheDocument();
  });
});
