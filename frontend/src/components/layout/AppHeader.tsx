import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Laptop, Moon, Sun, Bell, Search, Loader2, FileText, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { searchApi } from '@/api/search';
import { formatDistanceToNow } from 'date-fns';
import type { SearchResult, AuditLog } from '@/types';

type Theme = 'light' | 'dark' | 'system';

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/editor/')) return 'Editor';
  if (pathname.startsWith('/analysis/')) return 'Analysis';
  if (pathname === '/new-project') return 'New Project';
  if (pathname === '/git-connect') return 'Git Connect';
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/dashboard/projects')) return 'Projects';
  if (pathname.startsWith('/dashboard/templates')) return 'Outlines';
  if (pathname.startsWith('/dashboard/settings')) return 'Settings';
  return 'Dashboard';
}

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const activeOrgId = useOrgStore(s => s.activeOrgId);
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

  const pageTitle = getPageTitle(location.pathname);

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  // Load audit logs when notification panel opens
  useEffect(() => {
    if (notifOpen && activeOrgId) {
      setLogsLoading(true);
      orgApi.listAuditLogs(activeOrgId, 1, 10)
        .then(setAuditLogs)
        .catch(() => setAuditLogs([]))
        .finally(() => setLogsLoading(false));
    }
  }, [notifOpen, activeOrgId]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.search(searchQuery);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close panels on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node) && searchOpen) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  const handleSearchSelect = (item: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/editor/${item.project_id}`);
  };

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4">
        {/* Left: page title */}
        <h1 className="text-sm font-semibold text-foreground shrink-0 min-w-0 truncate">
          {pageTitle}
        </h1>

        {/* Center: global search */}
        <div ref={searchRef} className="relative flex-1 max-w-md mx-auto">
          <div
            className="relative cursor-text"
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}
          >
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search documentation..."
              className="w-full rounded-md border border-border bg-muted/40 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:border-primary focus:bg-background transition-colors"
            />
            {searchLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchOpen && (searchQuery.trim() || searchResults.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-50 max-h-72 overflow-y-auto">
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
                  className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
                >
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{item.project_name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">/</span>
                      <span className="text-[10px] text-muted-foreground truncate">{item.document_title}</span>
                    </div>
                    {item.content_excerpt && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{item.content_excerpt}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
            <ThemeIcon className="h-4 w-4" />
          </Button>

          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <Bell className="h-4 w-4" />
            </Button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg z-50">
                <div className="px-4 py-2.5 border-b border-border">
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
                    let icon = <Info className="h-3.5 w-3.5 text-blue-500" />;
                    if (log.action?.toLowerCase().includes('create') || log.action?.toLowerCase().includes('invite')) {
                      icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
                    } else if (log.action?.toLowerCase().includes('delete') || log.action?.toLowerCase().includes('remove')) {
                      icon = <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
                    }
                    return (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                        {icon}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground">
                            <span className="font-medium">{log.user_name}</span> {log.action}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{log.resource}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/dashboard/settings?tab=activity'); }}
                    className="text-xs text-primary hover:underline w-full text-center"
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
