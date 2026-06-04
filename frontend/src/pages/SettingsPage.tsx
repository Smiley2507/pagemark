import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AiProvidersSection } from '@/components/settings/AiProvidersSection';
import { OrgSettingsView, OrgMembersView, OrgAuditLogView, OrgApiKeysView } from '@/components/org';
import {
  User,
  Building2,
  Users,
  Bot,
  Key,
  Activity,
  Search,
} from 'lucide-react';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, admin: false },
  { id: 'organization', label: 'Organization', icon: Building2, admin: true },
  { id: 'members', label: 'Members', icon: Users, admin: false },
  { id: 'ai-providers', label: 'AI Providers', icon: Bot, admin: false },
  { id: 'api-keys', label: 'API Keys', icon: Key, admin: false },
  { id: 'activity', label: 'Activity Log', icon: Activity, admin: false },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const [sectionSearch, setSectionSearch] = useState('');

  const setTab = (tab: string) => {
    searchParams.set('tab', tab);
    setSearchParams(searchParams);
  };

  const filtered = SECTIONS.filter((s) =>
    s.label.toLowerCase().includes(sectionSearch.toLowerCase()),
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card/40 p-4 flex flex-col gap-1">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter sections…"
            value={sectionSearch}
            onChange={(e) => setSectionSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <nav className="flex flex-col gap-0.5">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-left transition-colors',
                activeTab === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' && <ProfileSection />}
        {activeTab === 'organization' && (
          <div className="p-6">
            <OrgSettingsView />
          </div>
        )}
        {activeTab === 'members' && (
          <div className="p-6">
            <OrgMembersView />
          </div>
        )}
        {activeTab === 'ai-providers' && (
          <div className="p-6 max-w-2xl">
            <AiProvidersSection />
          </div>
        )}
        {activeTab === 'api-keys' && (
          <div className="p-6">
            <OrgApiKeysView />
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="p-6">
            <OrgAuditLogView />
          </div>
        )}
      </div>
    </div>
  );
}
