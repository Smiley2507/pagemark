import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Bell, Bot, Building2, Key, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AiProvidersSection } from '@/components/settings/AiProvidersSection';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';
import { OrgApiKeysView, OrgAuditLogView, OrgSettingsView } from '@/components/org';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, keywords: ['account', 'identity', 'password', 'avatar'] },
  { id: 'organization', label: 'Organization', icon: Building2, keywords: ['org', 'workspace', 'quality'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, keywords: ['alert', 'preferences', 'events', 'bell'] },
  { id: 'ai-providers', label: 'AI Providers', icon: Bot, keywords: ['model', 'provider', 'byok', 'claude', 'opencode', 'google'] },
  { id: 'api-keys', label: 'API Keys', icon: Key, keywords: ['token', 'integration', 'automation'] },
  { id: 'activity', label: 'Activity Log', icon: Activity, keywords: ['audit', 'history', 'events'] },
] as const;

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const activeTab = searchParams.get('tab') || 'profile';

  const activeSection = SECTIONS.find((section) => section.id === activeTab) || SECTIONS[0];
  const filteredSections = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.filter((section) => {
      return (
        section.label.toLowerCase().includes(query) ||
        section.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      );
    });
  }, [filter]);

  const setTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  return (
    <div className="space-y-5">
      <Surface variant="panel" padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-section font-semibold text-text-primary">Settings</h1>
          </div>
          <div className="w-full max-w-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter settings"
                className="pl-9"
                aria-label="Filter settings sections"
              />
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Surface variant="muted" padding="default" className="space-y-2 self-start">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === activeSection.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setTab(section.id)}
                className={cn(
                  'w-full rounded border px-3 py-3 text-left transition-colors',
                  selected
                    ? 'border-interaction bg-panel text-text-primary'
                    : 'border-transparent bg-transparent text-text-secondary hover:border-separator hover:bg-panel'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-body font-medium">{section.label}</p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </Surface>

        <Surface variant="panel" padding="lg" className="space-y-5">
          <div className="border-b border-separator pb-4">
            <h2 className="text-section font-semibold text-text-primary">{activeSection.label}</h2>
          </div>

          {activeSection.id === 'profile' && <ProfileSection />}
          {activeSection.id === 'organization' && <OrgSettingsView />}
          {activeSection.id === 'notifications' && <NotificationPreferencesSection />}
          {activeSection.id === 'ai-providers' && <AiProvidersSection />}
          {activeSection.id === 'api-keys' && <OrgApiKeysView />}
          {activeSection.id === 'activity' && <OrgAuditLogView />}
        </Surface>
      </div>
    </div>
  );
}
