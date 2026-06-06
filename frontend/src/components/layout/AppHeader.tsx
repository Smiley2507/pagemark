import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Laptop, Moon, Sun, Bell, Search, Loader2, FileText, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { searchApi, type GlobalSearchSort, type GlobalSearchType } from '@/api/search';
import type { SearchResult, AuditLog } from '@/types';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';

type Theme = 'light' | 'dark' | 'system';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { theme, setTheme } = useThemeStore();
  const activeOrgId = useOrgStore((state) => state.activeOrgId);
  const recentWork = useViewPreferenceStore((state) => state.recentWork);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<GlobalSearchType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<GlobalSearchSort>('last_modified');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  useEffect(() => {
    if (notifOpen && activeOrgId) {
      setLogsLoading(true);
      orgApi.listAuditLogs(activeOrgId, 1, 10)
        .then(setAuditLogs)
        .catch(() => setAuditLogs([]))
        .finally(() => setLogsLoading(false));
    }
  }, [notifOpen, activeOrgId]);

  useEffect(() => {
    const hasFilters = searchType !== 'all' || tagFilter.trim() || statusFilter.trim();
    if (!searchQuery.trim() && !hasFilters) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await searchApi.search({
          q: searchQuery,
          tag: tagFilter,
          status: statusFilter,
          type: searchType,
          sort: sortBy,
        });
        const lastOpened = new Map<string, string>();
        recentWork.forEach((entry) => {
          lastOpened.set(`project:${entry.projectId}`, entry.timestamp);
          if (entry.documentId) {
            lastOpened.set(`document:${entry.documentId}`, entry.timestamp);
          }
          if (entry.sectionId) {
            lastOpened.set(`section:${entry.sectionId}`, entry.timestamp);
          }
        });
        const hydratedResults = result.map((item) => ({
          ...item,
          last_opened_at: lastOpened.get(`${item.type}:${item.id}`),
        }));
        if (sortBy === 'last_opened') {
          hydratedResults.sort((left, right) =>
            new Date(right.last_opened_at || right.last_modified_at).getTime() -
            new Date(left.last_opened_at || left.last_modified_at).getTime()
          );
        }
        setSearchResults(hydratedResults);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, tagFilter, statusFilter, sortBy, recentWork]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node) && searchOpen) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  const handleSearchSelect = (item: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (item.type === 'project') {
      navigate(`/projects/${item.project_id}`);
    } else if (item.type === 'document' && item.document_id) {
      navigate(`/projects/${item.project_id}/documents/${item.document_id}`);
    } else if (item.document_id) {
      navigate(`/projects/${item.project_id}/documents/${item.document_id}`);
    } else {
      navigate(`/projects/${item.project_id}`);
    }
  };

  const currentLabel = location.pathname.startsWith('/projects/') && params.projectId
    ? 'Project workspace'
    : location.pathname.startsWith('/projects')
      ? 'Project library'
      : location.pathname.startsWith('/templates')
        ? 'Template library'
        : location.pathname.startsWith('/settings')
          ? 'Settings'
          : 'Home';

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-separator bg-workspace/95 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-4 px-4">
        <div className="min-w-0">
          <p className="text-meta font-medium uppercase tracking-[0.12em] text-text-muted">
            {currentLabel}
          </p>
        </div>

        <div ref={searchRef} className="relative w-full max-w-xl">
          <div
            className="relative cursor-text"
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}
          >
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search Projects, Documents, Sections..."
              className="w-full rounded-md border border-input bg-panel py-1.5 pl-8 pr-3 text-sm text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchOpen && (searchQuery.trim() || searchType !== 'all' || tagFilter.trim() || statusFilter.trim() || searchResults.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-overlay">
              <div className="grid gap-2 border-b border-border p-2 md:grid-cols-4">
                <select
                  aria-label="Search entity type"
                  value={searchType}
                  onChange={(event) => setSearchType(event.target.value as GlobalSearchType)}
                  className="rounded-md border border-input bg-panel px-2 py-1.5 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All types</option>
                  <option value="project">Projects</option>
                  <option value="document">Documents</option>
                  <option value="section">Sections</option>
                </select>
                <input
                  aria-label="Search tag filter"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  placeholder="Tag"
                  className="rounded-md border border-input bg-panel px-2 py-1.5 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <select
                  aria-label="Search status filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-md border border-input bg-panel px-2 py-1.5 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Any status</option>
                  <option value="draft">Draft</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="needs_input">Needs input</option>
                  <option value="potentially_stale">Source changed</option>
                  <option value="generating">Generating</option>
                </select>
                <select
                  aria-label="Search sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as GlobalSearchSort)}
                  className="rounded-md border border-input bg-panel px-2 py-1.5 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="last_modified">Last modified</option>
                  <option value="last_opened">Last opened</option>
                  <option value="last_added">Last added</option>
                  <option value="name">Name</option>
                </select>
              </div>
              {searchLoading && searchResults.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Searching...</div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No results found</div>
              )}
              {searchResults.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSearchSelect(item)}
                  className="flex w-full items-start gap-2 border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 last:border-0"
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {item.type}
                      </span>
                      <span className="truncate text-xs font-medium">{item.title}</span>
                      {item.subtitle && <span className="truncate text-[10px] text-muted-foreground">{item.subtitle}</span>}
                    </div>
                    {(item.content_excerpt || item.status || item.tags.length > 0) && (
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">
                        {[item.content_excerpt, item.status, item.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
            <ThemeIcon className="h-4 w-4" />
          </Button>

          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotifOpen((current) => !current)}
            >
              <Bell className="h-4 w-4" />
            </Button>

            {notifOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-overlay">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-sm font-semibold">Notifications</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {logsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!logsLoading && auditLogs.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No recent activity
                    </div>
                  )}
                  {!logsLoading && auditLogs.map((log) => {
                    let icon = <Info className="h-3.5 w-3.5 text-text-secondary" />;
                    if (log.action?.toLowerCase().includes('create') || log.action?.toLowerCase().includes('invite')) {
                      icon = <CheckCircle2 className="h-3.5 w-3.5 text-status-success-foreground" />;
                    } else if (log.action?.toLowerCase().includes('delete') || log.action?.toLowerCase().includes('remove')) {
                      icon = <AlertTriangle className="h-3.5 w-3.5 text-status-danger-foreground" />;
                    }
                    return (
                      <div key={log.id} className="flex items-start gap-3 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-muted/40 last:border-0">
                        {icon}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground">
                            <span className="font-medium">{log.user_name}</span> {log.action}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{log.resource}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/settings?tab=activity'); }}
                    className="w-full text-center text-xs text-primary hover:underline"
                  >
                    View all activity
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
