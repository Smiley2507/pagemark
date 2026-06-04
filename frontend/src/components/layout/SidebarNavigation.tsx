import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  FolderPlus,
  Settings,
  LayoutTemplate,
  Tags,
  Building2,
  LogOut,
  ChevronRight,
  Check,
  PlusCircle,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PagemarkWordmark } from './PagemarkWordmark';
import { projectsApi } from '@/api/projects';
import { useOrgStore } from '@/store/orgStore';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { orgApi } from '@/api/org';
import { toast } from 'sonner';

export function SidebarNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const activeTag = searchParams.get('tag') || '';
  const currentRole = useOrgStore((s) => s.currentRole);
  const user = useAuthStore((s) => s.user);
  const { organizations, activeOrgId, setActiveOrgId, setOrganizations } = useOrgStore();
  const logoutMutation = useLogout();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  const activeOrg = organizations.find(o => o.id === activeOrgId);

  const refreshOrgs = () => {
    orgApi.listOrganizations().then(setOrganizations).catch(console.error);
  };

  useEffect(() => {
    projectsApi.getTags().then((t) => {
      setTags(t);
      const counts: Record<string, number> = {};
      t.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
      setTagCounts(counts);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const setTagFilter = (tag: string) => {
    if (tag === activeTag) {
      searchParams.delete('tag');
    } else {
      searchParams.set('tag', tag);
    }
    setSearchParams(searchParams);
  };

  const topTags = tags.slice(0, 3);

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const org = await orgApi.createOrganization(createName.trim());
      toast.success(`Organization "${org.name}" created`);
      setCreateOpen(false);
      setCreateName('');
      await refreshOrgs();
      setActiveOrgId(org.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinToken.trim()) return;
    setJoining(true);
    try {
      await orgApi.acceptInvite(joinToken.trim());
      toast.success('Joined organization successfully');
      setJoinOpen(false);
      setJoinToken('');
      await refreshOrgs();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to join organization');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <div className="flex h-screen w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm">
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-border px-4">
          <PagemarkWordmark className="h-12" />
        </div>

        {/* Quick action: New Project */}
        <div className="px-3 pt-3 pb-2">
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/new-project')}
          >
            <FolderPlus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={isActive('/dashboard')} />
          <NavLink href="/dashboard/templates" icon={LayoutTemplate} label="Templates" isActive={isActive('/dashboard/templates')} />

          {/* Tags */}
          {topTags.length > 0 && (
            <>
              <div className="pt-4 pb-1">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</span>
                  {activeTag && (
                    <button
                      onClick={() => { searchParams.delete('tag'); setSearchParams(searchParams); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {topTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors text-left',
                    activeTag === tag
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Tags className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{tag}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{tagCounts[tag] || 0}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border px-3 py-3 space-y-2">
          <NavLink href="/dashboard/settings" icon={Settings} label="Settings" isActive={isActive('/dashboard/settings')} />

          {/* Profile card */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user?.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{user?.name || 'User'}</div>
                <div className="truncate text-xs text-muted-foreground">{activeOrg?.name || 'No organization'}</div>
              </div>
              <ChevronRight className={cn('h-4 w-4 transition-transform', profileOpen && 'rotate-90')} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-80 zoom-in-95">
                <div className="max-h-[250px] overflow-y-auto">
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => {
                        setActiveOrgId(org.id);
                        setProfileOpen(false);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                        org.id === activeOrgId && 'bg-accent/50'
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{org.name}</span>
                      {org.personal && <span className="text-xs text-muted-foreground">Personal</span>}
                      {org.id === activeOrgId && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  ))}
                </div>
                <div className="my-1 h-px bg-border" />
                <div
                  onClick={() => { setProfileOpen(false); setCreateOpen(true); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create Organization
                </div>
                <div
                  onClick={() => { setProfileOpen(false); setJoinOpen(true); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                >
                  <UserPlus className="h-4 w-4" />
                  Join Organization
                </div>
                <div className="my-1 h-px bg-border" />
                <div
                  onClick={() => { setProfileOpen(false); navigate('/dashboard/settings'); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Account Settings
                </div>
                <div
                  onClick={() => { setProfileOpen(false); logoutMutation.mutate(); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-red-500 hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization name</label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="My Organization"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!createName.trim() || creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Organization Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite token</label>
              <Input
                value={joinToken}
                onChange={e => setJoinToken(e.target.value)}
                placeholder="Paste invite token here"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={joining}>
                Cancel
              </Button>
              <Button onClick={handleJoin} disabled={!joinToken.trim() || joining}>
                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NavLink({ href, icon: Icon, label, isActive }: { href: string; icon: any; label: string; isActive: boolean }) {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-l-2',
        isActive
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
