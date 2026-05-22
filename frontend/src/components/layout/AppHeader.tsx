import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Laptop, LogOut, Moon, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLogout } from '@/hooks/useAuth';
import { PagemarkWordmark } from './PagemarkWordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

export function AppHeader({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useThemeStore();
  const logoutMutation = useLogout();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PagemarkWordmark className="text-section" />
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label="Toggle theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              className={cn(
                'flex items-center gap-2 rounded-md border border-border px-2 py-1 transition-colors',
                'hover:bg-accent',
                profileMenuOpen && 'bg-accent'
              )}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <img
                src={
                  user?.avatar_url ||
                  `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.name || 'pagemark'}`
                }
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
              <span className="hidden max-w-[120px] truncate text-meta font-medium sm:inline">
                {user?.name}
              </span>
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-border bg-surface-elevated p-1.5 shadow-sm"
              >
                <div className="px-2.5 py-2">
                  <p className="text-meta-sm text-muted-foreground">Signed in as</p>
                  <p className="truncate text-meta font-semibold text-foreground">
                    {user?.email}
                  </p>
                </div>
                <div className="my-1 h-px bg-border" />
                {onOpenSettings && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onOpenSettings();
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-body hover:bg-accent"
                  >
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    Profile settings
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate('/git-connect');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-body hover:bg-accent"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Connected accounts
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logoutMutation.mutate();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-body text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
