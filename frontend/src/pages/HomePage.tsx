import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, FolderKanban, GitBranch, PenLine, Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { documentsApi } from '@/api/documents';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { orgApi } from '@/api/org';
import type { PendingInvite } from '@/types';
import {
  buildProjectWorkspaceSummary,
  filterProjectSummaries,
  ProjectLibrary,
} from '@/components/workspace/project-library';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type OverviewTab = 'recent-documents' | 'recent-projects' | 'need-review' | 'source-changes' | 'drafts';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setOrganizations, setActiveOrgId } = useOrgStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'active' | 'stale' | 'resume'>('all');
  const [activeOverviewTab, setActiveOverviewTab] = useState<OverviewTab>('recent-documents');
  const getRecentProjects = useViewPreferenceStore((state) => state.getRecentProjects);
  const user = useAuthStore((state) => state.user);
  const userName = user?.name || user?.email?.split('@')[0] || 'there';
  const greetingText = `${getTimeGreeting()}, ${userName}`;
  const [typedGreeting, setTypedGreeting] = useState('');

  useEffect(() => {
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setTypedGreeting(greetingText);
      return;
    }

    setTypedGreeting('');
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedGreeting(greetingText.slice(0, index));
      if (index >= greetingText.length) {
        window.clearInterval(interval);
      }
    }, 42);

    return () => window.clearInterval(interval);
  }, [greetingText]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({}),
  });

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['pending-invites'],
    queryFn: () => orgApi.listPendingInvites(),
    refetchInterval: 30_000,
  });

  const { mutate: acceptInvite } = useMutation({
    mutationFn: (token: string) => orgApi.acceptInvite(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      orgApi.listOrganizations().then(setOrganizations);
      if (data?.org_id) {
        setActiveOrgId(data.org_id);
      }
      toast.success(`Joined ${data?.org_name || 'organization'} successfully`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to accept invitation');
    },
  });

  const documentQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['documents', project.id],
      queryFn: () => documentsApi.listDocuments(project.id),
      enabled: projects.length > 0,
    })),
  });

  const summaries = useMemo(() => (
    projects.map((project, index) =>
      buildProjectWorkspaceSummary(project, documentQueries[index]?.data?.documents || [])
    )
  ), [documentQueries, projects]);

  const allDocuments = summaries.flatMap((summary) =>
    summary.documents.map((document) => ({ document, project: summary.project }))
  );
  const recentDocuments = [...allDocuments]
    .sort((left, right) => new Date(right.document.last_activity_at).getTime() - new Date(left.document.last_activity_at).getTime())
    .slice(0, 5);
  const recentProjects = [...summaries]
    .sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime())
    .slice(0, 5);
  const reviewDocuments = allDocuments
    .filter(({ document }) => document.status.toLowerCase().includes('needs') || document.status.toLowerCase().includes('review'))
    .slice(0, 5);
  const draftDocuments = allDocuments
    .filter(({ document }) => document.status.toLowerCase().includes('draft') || document.progress.pct < 100)
    .slice(0, 5);
  const staleDocuments = allDocuments
    .filter(({ document }) => document.freshness.toLowerCase().includes('stale') || document.status.toLowerCase().includes('stale'))
    .slice(0, 5);

  const filteredLibrary = filterProjectSummaries(
    summaries,
    libraryFilter,
    getRecentProjects(),
    searchQuery
  );

  const overviewTabs = [
    {
      id: 'recent-documents' as const,
      label: 'Recent documents',
      icon: FileText,
      items: recentDocuments.map(({ document, project }) => ({
        id: `recent-doc-${document.id}`,
        title: document.title,
        meta: `${project.name} / ${formatDate(document.last_activity_at)}`,
        onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
      })),
    },
    {
      id: 'recent-projects' as const,
      label: 'Recent projects',
      icon: FolderKanban,
      items: recentProjects.map((summary) => ({
        id: `recent-project-${summary.project.id}`,
        title: summary.project.name,
        meta: `${summary.documentCount} Documents / ${formatDate(summary.lastActivityAt)}`,
        onOpen: () => navigate(`/projects/${summary.project.id}`),
      })),
    },
    {
      id: 'need-review' as const,
      label: 'Need review',
      icon: TriangleAlert,
      items: reviewDocuments.map(({ document, project }) => ({
        id: `review-${document.id}`,
        title: document.title,
        meta: project.name,
        onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
      })),
    },
    {
      id: 'source-changes' as const,
      label: 'Source changes',
      icon: GitBranch,
      items: staleDocuments.map(({ document, project }) => ({
        id: `stale-${document.id}`,
        title: document.title,
        meta: project.name,
        onOpen: () => navigate(`/projects/${project.id}`),
      })),
    },
    {
      id: 'drafts' as const,
      label: 'Drafts in progress',
      icon: PenLine,
      items: draftDocuments.map(({ document, project }) => ({
        id: `draft-${document.id}`,
        title: document.title,
        meta: `${project.name} / ${document.progress.pct}% reviewed`,
        onOpen: () => navigate(`/projects/${project.id}/documents/${document.id}`),
      })),
    },
  ];
  const activeOverview = overviewTabs.find((tab) => tab.id === activeOverviewTab) || overviewTabs[0];

  return (
    <div className="dashboard-atmosphere min-h-screen space-y-6 px-8 pb-6 pt-12">
      <section className="pb-14 pt-3">
        <p className="text-[2rem] font-semibold leading-tight text-text-primary" aria-label={greetingText}>
          <span aria-hidden="true">{typedGreeting || '\u00A0'}</span>
          <span aria-hidden="true" className="dashboard-type-cursor ml-1 inline-block h-8 w-0.5 translate-y-1 bg-text-primary" />
        </p>
      </section>

      {pendingInvites.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">!</span>
            <h2 className="text-title font-semibold text-amber-600 dark:text-amber-400">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-amber-500/10">
            {pendingInvites.map((invite) => (
              <div key={`${invite.org_id}-${invite.invited_at}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-amber-800 dark:text-amber-200">
                    {invite.org_name}
                  </p>
                  <p className="text-meta text-amber-600/70 dark:text-amber-400/70">
                    Invited by {invite.invited_by_name || invite.invited_by_email || 'someone'}
                    {invite.expires_at && ` · Expires ${formatDate(invite.expires_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptInvite(invite.invite_token)}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Surface variant="panel" padding="none" className="overflow-hidden">
        <div className="border-b border-separator px-5 py-4">
          <h1 className="text-title font-semibold text-text-primary">Overview</h1>
        </div>
        <div className="grid min-h-80 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Overview sections" className="border-b border-separator p-3 lg:border-b-0 lg:border-r">
            <div className="space-y-1">
              {overviewTabs.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === activeOverview.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveOverviewTab(tab.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-meta transition-colors',
                      active
                        ? 'bg-interaction-muted text-interaction-hover'
                        : 'text-text-secondary hover:bg-panel-muted hover:text-text-primary',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium">{tab.label}</span>
                    </span>
                    <span className="shrink-0 text-xs">{tab.items.length}</span>
                  </button>
                );
              })}
            </div>
          </nav>
          <div className="min-w-0 p-4">
            {activeOverview.items.length === 0 ? (
              <p className="text-body text-text-muted">Nothing here</p>
            ) : (
              <div className="divide-y divide-separator">
                {activeOverview.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onOpen}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-panel-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium text-text-primary">{item.title}</span>
                      <span className="block truncate text-meta text-text-muted">{item.meta}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Surface>

      <ProjectLibrary
        summaries={filteredLibrary}
        onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
        onCreateProject={() => navigate('/new-project')}
        emptyTitle="No Projects found"
        emptyDescription={searchQuery ? 'No Projects match the current search or filter.' : 'Create a Project to start.'}
        headerActions={(
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative w-full min-w-0 xl:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                aria-label="Search project library"
                className="pl-9"
                placeholder="Search Projects, Templates, or tags"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <SegmentedControl
              label="Project library filter"
              value={libraryFilter}
              onValueChange={(value) => setLibraryFilter(value as 'all' | 'active' | 'stale' | 'resume')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'stale', label: 'Changed' },
                { value: 'resume', label: 'Recent' },
              ]}
            />
            <Button type="button" onClick={() => navigate('/new-project')} className="gap-2">
              <PenLine className="h-4 w-4" />
              New Project
            </Button>
          </div>
        )}
      />
    </div>
  );
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
