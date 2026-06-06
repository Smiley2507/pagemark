import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Bell, Bot, Building2, Download, GitBranch, Key, LayoutTemplate, Search, Shield, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AiProvidersSection } from '@/components/settings/AiProvidersSection';
import { OrgApiKeysView, OrgAuditLogView, OrgMembersView, OrgSettingsView } from '@/components/org';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, summary: 'Identity, email, password, and avatar.', keywords: ['account', 'identity', 'password', 'avatar'] },
  { id: 'organization', label: 'Organization', icon: Building2, summary: 'Shared workspace defaults and governance.', keywords: ['org', 'workspace', 'billing', 'defaults'] },
  { id: 'members', label: 'Members', icon: Users, summary: 'Invites, roles, and team access.', keywords: ['team', 'invite', 'role', 'access'] },
  { id: 'ai-providers', label: 'AI Providers & Models', icon: Bot, summary: 'Provider credentials and active model selection.', keywords: ['model', 'provider', 'byok', 'claude', 'openai', 'google'] },
  { id: 'source-connections', label: 'Source Connections', icon: GitBranch, summary: 'Git providers, repository access, and sync defaults.', keywords: ['github', 'gitlab', 'repository', 'branch', 'sync', 'source'] },
  { id: 'export-defaults', label: 'Export Defaults', icon: Download, summary: 'Default format, branding, and destination preferences.', keywords: ['pdf', 'markdown', 'html', 'brand', 'logo'] },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, summary: 'Built-in, organization, and personal Template defaults.', keywords: ['outline', 'document purpose', 'custom outline'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, summary: 'Activity, review, source-change, and provider alerts.', keywords: ['email', 'digest', 'alerts', 'review', 'freshness'] },
  { id: 'api-keys', label: 'API Keys', icon: Key, summary: 'Programmatic access for integrations.', keywords: ['token', 'integration', 'automation'] },
  { id: 'security', label: 'Security', icon: Shield, summary: 'Sessions, credential handling, and organization controls.', keywords: ['session', 'audit', 'credential', 'encryption'] },
  { id: 'activity', label: 'Activity Log', icon: Activity, summary: 'Meaningful admin and membership changes.', keywords: ['audit', 'history', 'events'] },
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
        section.summary.toLowerCase().includes(query) ||
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
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Settings</p>
            <h1 className="text-section font-semibold text-text-primary">Workspace preferences</h1>
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
          Provider, organization, member, and security changes affect future Project and Document work.
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
          {activeSection.id === 'source-connections' && (
            <SettingsDetail
              title="Source Connections"
              rows={[
                ['GitHub', 'Connect repositories from Project creation or source settings.'],
                ['Repository sync', 'Project Source controls current sync and Analysis state.'],
                ['ZIP uploads', 'ZIP Projects can compare against a newer uploaded archive.'],
              ]}
            />
          )}
          {activeSection.id === 'export-defaults' && (
            <SettingsDetail
              title="Export Defaults"
              rows={[
                ['Default scope', 'Exports produce one Document by default.'],
                ['Formats', 'Markdown, HTML, and PDF defaults are stored per Document when customized.'],
                ['Branding', 'Organization defaults can be reused across Documents.'],
              ]}
            />
          )}
          {activeSection.id === 'templates' && (
            <SettingsDetail
              title="Template Defaults"
              rows={[
                ['Library', 'Template management lives in the Template library.'],
                ['Ownership', 'Built-in, organization, and personal Templates stay distinct.'],
                ['Custom Outline', 'A Custom Outline becomes reusable only when saved as a Template.'],
              ]}
            />
          )}
          {activeSection.id === 'notifications' && (
            <SettingsDetail
              title="Notifications"
              rows={[
                ['Review', 'Needs-input and review-ready events appear in Home and notifications.'],
                ['Source changes', 'Freshness events are surfaced without modifying reviewed content.'],
                ['Provider alerts', 'Provider exhaustion and failover prompts require explicit confirmation.'],
              ]}
            />
          )}
          {activeSection.id === 'api-keys' && <OrgApiKeysView />}
          {activeSection.id === 'security' && (
            <SettingsDetail
              title="Security"
              rows={[
                ['Provider credentials', 'Stored per account and used only for requested provider work.'],
                ['Organization access', 'Project and Document access follows organization membership.'],
                ['Activity', 'Administrative events are available in the Activity Log.'],
              ]}
            />
          )}
          {activeSection.id === 'activity' && <OrgAuditLogView />}
        </Surface>
      </div>
    </div>
  );
}

function SettingsDetail({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-body-lg font-semibold text-text-primary">{title}</h3>
      <div className="divide-y divide-separator rounded-md border border-separator">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-3 py-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <span className="text-body font-medium text-text-primary">{label}</span>
            <span className="text-body text-text-secondary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
