import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type ElementType, useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  FileBarChart,
  FolderKanban,
  Hash,
  House,
  LayoutTemplate,
  Loader2,
  LogOut,
  Plus,
  PlusCircle,
  Settings,
  Users,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PagemarkWordmark } from './PagemarkWordmark';
import { useOrgStore } from '@/store/orgStore';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { orgApi } from '@/api/org';
import { projectsApi } from '@/api/projects';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useHasCapability } from '@/hooks/useHasCapability';
import { PROJECT_MANAGE, ORG_AUDIT } from '@/lib/authz';

export function SidebarNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { organizations, activeOrgId, setActiveOrgId, setOrganizations } = useOrgStore();
  const logoutMutation = useLogout();
  const canManageProjects = useHasCapability(PROJECT_MANAGE);
  const canViewReports = useHasCapability(ORG_AUDIT);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  const activeOrg = organizations.find((organization) => organization.id === activeOrgId);
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeOrgId, 'sidebar-tags'],
    queryFn: () => projectsApi.getProjects({}),
    enabled: !!activeOrgId,
  });

  const topTags = projects
    .flatMap((project) => project.tags || [])
    .reduce<Map<string, number>>((counts, tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
      return counts;
    }, new Map<string, number>());
  const tagItems = Array.from(topTags.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3);

  const refreshOrgs = () => {
    orgApi.listOrganizations().then(setOrganizations).catch(console.error);
  };

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

  const isActive = (href: string) => {
    if (href === '/home') {
      return location.pathname === '/home';
    }
    if (href === '/projects') {
      return location.pathname === '/projects' || /^\/projects\/\d+/.test(location.pathname);
    }
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
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to create organization');
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
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to join organization');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <div className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <PagemarkWordmark className="h-12" />
        </div>

        <div className="px-3 pb-2 pt-3">
          {canManageProjects && (
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/new-project')}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Global navigation">
          <NavLink href="/home" icon={House} label="Home" isActive={isActive('/home')} />
          <NavLink href="/projects" icon={FolderKanban} label="Projects" isActive={isActive('/projects')} />
          <NavLink href="/templates" icon={LayoutTemplate} label="Templates" isActive={isActive('/templates')} />
          <NavLink href="/members" icon={Users} label="Members" isActive={isActive('/members')} />
          {canViewReports && (
            <NavLink href="/reports" icon={FileBarChart} label="Reports" isActive={isActive('/reports')} />
          )}
          <div className="px-3 pb-1 pt-4 text-meta font-medium uppercase text-sidebar-foreground/50">
            Tags
          </div>
          {tagItems.length > 0 ? tagItems.map(([tag, count]) => (
            <Link
              key={tag}
              to={`/projects?tag=${encodeURIComponent(tag)}`}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Hash className="h-4 w-4 shrink-0" />
                <span className="truncate">{tag}</span>
              </span>
              <span className="text-xs text-sidebar-foreground/56">{count}</span>
            </Link>
          )) : (
            <div className="px-3 py-2 text-sm text-sidebar-foreground/56">
              No tags yet
            </div>
          )}
          <NavLink href="/settings" icon={Settings} label="Settings" isActive={isActive('/settings')} />
        </nav>

        <div className="space-y-2 border-t border-sidebar-border px-3 py-3">
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
                  {(user?.name || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-sidebar-foreground">{user?.name || 'User'}</div>
                <div className="flex items-center gap-1.5">
                  {activeOrg?.avatar_url ? (
                    <img src={activeOrg.avatar_url} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />
                  ) : null}
                  <span className="truncate text-xs text-sidebar-foreground/70">{activeOrg?.name || 'No organization'}</span>
                </div>
              </div>
              <ChevronRight className={cn('h-4 w-4 transition-transform', profileOpen && 'rotate-90')} />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-overlay">
                <div className="max-h-[250px] overflow-y-auto">
                  {organizations.map((organization) => (
                    <div
                      key={organization.id}
                      onClick={() => {
                        setActiveOrgId(organization.id);
                        setProfileOpen(false);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                        organization.id === activeOrgId && 'bg-accent/50'
                      )}
                    >
                      {organization.avatar_url ? (
                        <img src={organization.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-sm object-cover" />
                      ) : (
                        <Building2 className="h-4 w-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{organization.name}</span>
                      {organization.personal && <span className="text-xs text-muted-foreground">Personal</span>}
                      {organization.id === activeOrgId && <Check className="h-4 w-4 text-primary" />}
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
                  onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Account Settings
                </div>
                <div
                  onClick={() => { setProfileOpen(false); logoutMutation.mutate(); }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-status-danger-foreground hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="My Organization"
                onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
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
                onChange={(event) => setJoinToken(event.target.value)}
                placeholder="Paste invite token here"
                onKeyDown={(event) => event.key === 'Enter' && handleJoin()}
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

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: ElementType;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
