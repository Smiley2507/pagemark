import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderPlus,
  UserCog,
  LayoutTemplate,
  Tags,
  Users,
  Activity,
  Key,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrgSwitcher } from './OrgSwitcher';
import { PagemarkWordmark } from './PagemarkWordmark';
import { projectsApi } from '@/api/projects';
import { useOrgStore } from '@/store/orgStore';

export function SidebarNavigation() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<string[]>([]);
  const activeTag = searchParams.get('tag') || '';
  const currentRole = useOrgStore((s) => s.currentRole);

  useEffect(() => {
    projectsApi.getTags().then(setTags).catch(() => {});
  }, []);

  const setTagFilter = (tag: string) => {
    if (tag === activeTag) {
      searchParams.delete('tag');
    } else {
      searchParams.set('tag', tag);
    }
    setSearchParams(searchParams);
  };

  const isAdmin = currentRole === 'ADMIN';

  const orgLinks = [];
  if (isAdmin) {
    orgLinks.push({ href: '/dashboard/settings', label: 'Settings', icon: UserCog });
  }
  orgLinks.push(
    { href: '/dashboard/members', label: 'Members', icon: Users },
    { href: '/dashboard/activity', label: 'Activity Log', icon: Activity },
  );
  if (isAdmin) {
    orgLinks.push({ href: '/dashboard/api-keys', label: 'API Keys', icon: Key });
  }

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
      links: orgLinks,
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

        {tags.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</span>
              {activeTag && (
                <button
                  onClick={() => { searchParams.delete('tag'); setSearchParams(searchParams); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm w-full text-left transition-colors',
                  activeTag === tag
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Tags className="h-3.5 w-3.5" />
                <span className="truncate">{tag}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

    </div>
  );
}
