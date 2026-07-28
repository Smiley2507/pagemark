import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotificationPreferences';
import type { NotificationPreferences } from '@/api/notifications';
import { cn } from '@/lib/utils';

const CATEGORIES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  { key: 'member_activity', label: 'Member activity', description: 'Members joining or leaving the organization' },
  { key: 'document_sharing', label: 'Document sharing', description: 'Documents shared or unshared with you' },
  { key: 'document_notes', label: 'Document notes', description: 'Comments and notes on Documents' },
  { key: 'generation', label: 'Generation', description: 'Generation runs completing or failing' },
  { key: 'quality', label: 'Quality', description: 'Quality analysis failures' },
  { key: 'stale_sections', label: 'Stale sections', description: 'Source changes making sections potentially stale' },
  { key: 'source_sync', label: 'Source sync', description: 'Repository synchronization events' },
  { key: 'invites', label: 'Invites', description: 'Organization membership invitations' },
];

function Toggle({
  pressed,
  onPress,
  label,
}: {
  pressed: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      onClick={onPress}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        pressed ? 'bg-interaction' : 'bg-panel-muted'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform',
          pressed ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export function NotificationPreferencesSection() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  const prefs = localPrefs ?? preferences;

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setLocalPrefs(next);
    updateMutation.mutate(next);
  };

  if (isLoading) {
    return (
      <Surface variant="panel" padding="lg">
        <p className="text-body text-text-secondary">Loading notification preferences...</p>
      </Surface>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 text-interaction" />
        <div className="space-y-1">
          <h3 className="text-section font-semibold text-text-primary">Notification preferences</h3>
          <p className="text-meta text-text-secondary">
            Choose which workflow events appear in the notification popover.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((category) => {
          const enabled = prefs?.[category.key] ?? true;
          return (
            <Surface key={category.key} variant="muted" padding="default" className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <p className="text-body font-medium text-text-primary">{category.label}</p>
                <p className="text-meta-sm text-text-secondary">{category.description}</p>
              </div>
              <Toggle
                pressed={enabled}
                onPress={() => handleToggle(category.key)}
                label={`${category.label} ${enabled ? 'enabled' : 'disabled'}`}
              />
            </Surface>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocalPrefs(null)}
          disabled={!localPrefs || updateMutation.isPending}
        >
          Reset to saved
        </Button>
      </div>
    </div>
  );
}
