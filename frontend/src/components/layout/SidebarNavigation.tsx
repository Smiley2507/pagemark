import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderPlus,
  UserCog,
  LayoutTemplate
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrgSwitcher } from './OrgSwitcher';
import { PagemarkWordmark } from './PagemarkWordmark';

export function SidebarNavigation() {
  const location = useLocation();

  const navGroups = [
    {
      group: 'Main',
      links: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate },
      ]
    },
    {
      group: 'Organization',
      links: [
        { href: '/dashboard/settings', label: 'Settings', icon: UserCog },
      ]
    },
    {
      group: 'Workspace',
      links: [
        { href: '/new-project', label: 'New Project', icon: FolderPlus },
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

    </div>
  );
}
