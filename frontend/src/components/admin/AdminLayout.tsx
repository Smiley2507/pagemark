import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Activity, Settings, Shield,
  LogOut, ChevronLeft, ChevronRight, Sun, Moon, Laptop,
} from 'lucide-react';
import { useState } from 'react';
import { useAdminStore } from '@/store/adminStore';
import { useThemeStore, type Theme } from '@/store/themeStore';
import { clearAdminToken } from '@/api/admin';

const adminNavItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/organizations', icon: Building2, label: 'Organizations' },
  { href: '/admin/activity', icon: Activity, label: 'Activity' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
  { href: '/admin/pending-admins', icon: Shield, label: 'Pending Admins' },
];

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const clearSession = useAdminStore((s) => s.clearSession);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    clearAdminToken();
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin Sidebar */}
      <aside
        className={`flex flex-col border-r border-separator bg-panel transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-52'
        }`}
      >
        {/* Logo / Header */}
        <div className="flex h-12 items-center justify-between border-b border-separator px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Admin</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-text-muted hover:bg-panel-muted hover:text-text-primary"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-2">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:bg-panel-muted hover:text-text-primary'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Theme + Logout */}
        <div className="border-t border-separator p-2 space-y-1">
          <ThemeToggle collapsed={collapsed} />
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-text-muted transition-colors hover:bg-panel-muted hover:text-status-danger-foreground ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useThemeStore();
  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop;

  return (
    <button
      onClick={cycleTheme}
      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary ${
        collapsed ? 'justify-center px-0' : ''
      }`}
      title={`Theme: ${theme}`}
    >
      <Icon size={18} />
      {!collapsed && <span className="capitalize">{theme}</span>}
    </button>
  );
}
