import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderPlus,
  Library,
  Settings,
  LogOut,
  Sun,
  Moon,
  Laptop,
  User as UserIcon,
  Users,
  Activity,
  Key,
  UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrgSwitcher } from './OrgSwitcher';
import { PagemarkWordmark } from './PagemarkWordmark';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useThemeStore } from '@/store/themeStore';
import { useOrgStore } from '@/store/orgStore';

export function SidebarNavigation({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogout();
  const { theme, setTheme } = useThemeStore();
  const { currentRole } = useOrgStore();

  const cycleTheme = () => {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  const isAdmin = currentRole === 'ADMIN' || currentRole === 'PROJECT_MANAGER';

  const navGroups = [
    {
      group: 'Organization',
      links: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(isAdmin ? [
          { href: '/dashboard/members', label: 'Members', icon: Users },
          { href: '/dashboard/activity', label: 'Activity Log', icon: Activity },
          { href: '/dashboard/keys', label: 'API Keys', icon: Key },
        ] : []),
        { href: '/dashboard/settings', label: 'Org Settings', icon: UserCog },
      ]
    },
    {
      group: 'Workspace',
      links: [
        { href: '/new-project', label: 'New Project', icon: FolderPlus },
        { href: '/knowledge-base', label: 'Knowledge Base', icon: Library },
      ]
    }
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm">
      {/* Brand & Wordmark */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <PagemarkWordmark className="text-section" />
      </div>

      {/* Org Switcher */}
      <div className="border-b border-border p-4">
        <OrgSwitcher />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 space-y-6 p-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.group}
            </div>
            {group.links.map((link) => {
              const isActive = location.pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Settings & User Menu */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center gap-2 mb-4 px-2">
          <img
            src={
              user?.avatar_url ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.name || 'pagemark'}`
            }
            alt=""
            className="h-8 w-8 rounded-full object-cover border border-border"
          />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium leading-tight">
              {user?.name}
            </span
            <span className="truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <UserIcon className="h-4 w-4" />
            Profile Settings
          </button>
        )}
        <Link
          to="/git-connect"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Connected Accounts
        </Link>
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            onClick={cycleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Toggle Theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
