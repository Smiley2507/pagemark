import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Bot, Building2, Key, Search, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AiProvidersSection } from '@/components/settings/AiProvidersSection';
import { OrgApiKeysView, OrgAuditLogView, OrgMembersView, OrgSettingsView } from '@/components/org';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, summary: 'Identity, email, password, and avatar.' },
  { id: 'organization', label: 'Organization', icon: Building2, summary: 'Shared workspace defaults and governance.' },
  { id: 'members', label: 'Members', icon: Users, summary: 'Invites, roles, and team access.' },
  { id: 'ai-providers', label: 'AI Providers', icon: Bot, summary: 'Provider credentials and active model selection.' },
  { id: 'api-keys', label: 'API Keys', icon: Key, summary: 'Programmatic access for integrations.' },
  { id: 'activity', label: 'Activity Log', icon: Activity, summary: 'Meaningful admin and membership changes.' },
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
        section.summary.toLowerCase().includes(query)
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
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Settings</p>
            <h1 className="text-section font-semibold text-text-primary">Workspace preferences</h1>
            <p className="mt-1 max-w-2xl text-body text-text-secondary">
              Compact controls for credentials, organization defaults, and admin workflows. Keep the work surface close and the chrome quiet.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter settings surfaces"
                className="pl-9"
                aria-label="Filter settings sections"
              />
            </div>
          </div>
        </div>

        <Notice variant="info" title="Workspace Scope">
          Provider credentials affect future AI work. Organization and member changes affect access across Projects and Documents.
        </Notice>
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
                  'w-full rounded-md border px-3 py-3 text-left transition-colors',
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
                      <p className="mt-1 text-meta text-text-muted">{section.summary}</p>
                    </div>
                  </div>
                  {selected && <Badge variant="review">Active</Badge>}
                </div>
              </button>
            );
          })}
        </Surface>

        <Surface variant="panel" padding="lg" className="space-y-5">
          <div className="border-b border-separator pb-4">
            <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Current Surface</p>
            <h2 className="text-section font-semibold text-text-primary">{activeSection.label}</h2>
            <p className="mt-1 text-body text-text-secondary">{activeSection.summary}</p>
          </div>

          {activeSection.id === 'profile' && <ProfileSection />}
          {activeSection.id === 'organization' && <OrgSettingsView />}
          {activeSection.id === 'members' && <OrgMembersView />}
          {activeSection.id === 'ai-providers' && <AiProvidersSection />}
          {activeSection.id === 'api-keys' && <OrgApiKeysView />}
          {activeSection.id === 'activity' && <OrgAuditLogView />}
        </Surface>
      </div>
    </div>
  );
}
