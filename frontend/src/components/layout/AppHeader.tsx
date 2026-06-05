import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Laptop, Moon, Sun, Bell, Search, Loader2, FileText, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { searchApi } from '@/api/search';
import type { SearchResult, AuditLog } from '@/types';

type Theme = 'light' | 'dark' | 'system';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { theme, setTheme } = useThemeStore();
  const activeOrgId = useOrgStore((state) => state.activeOrgId);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
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
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await searchApi.search(searchQuery);
        setSearchResults(result);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    navigate(`/projects/${item.project_id}/documents/${item.document_id}`);
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
              placeholder="Search Projects and Documents..."
              className="w-full rounded-md border border-input bg-panel py-1.5 pl-8 pr-3 text-sm text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchOpen && (searchQuery.trim() || searchResults.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-overlay">
              {searchLoading && searchResults.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Searching...</div>
              )}
              {!searchLoading && searchResults.length === 0 && searchQuery.trim() && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">No results found</div>
              )}
              {searchResults.map((item) => (
                <button
                  key={`${item.project_id}-${item.section_id}`}
                  onClick={() => handleSearchSelect(item)}
                  className="flex w-full items-start gap-2 border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 last:border-0"
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{item.project_name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">/</span>
                      <span className="truncate text-[10px] text-muted-foreground">{item.document_title}</span>
                    </div>
                    {item.content_excerpt && (
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">{item.content_excerpt}</p>
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
