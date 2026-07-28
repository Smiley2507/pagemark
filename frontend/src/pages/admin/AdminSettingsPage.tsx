import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { SystemSettings } from '@/api/admin';

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load settings'));
  }, []);

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminApi.updateSettings(settings);
      toast.success('Settings saved');
      setDirty(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">Loading...</div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-text-primary">System Settings</h1>

      <div className="space-y-6">
        <Surface padding="default">
          <h2 className="mb-4 text-sm font-medium text-text-primary">General</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Allow Public Signup</p>
                <p className="text-xs text-text-muted">Allow new users to register</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allow_public_signup}
                onChange={(e) => update('allow_public_signup', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Maintenance Mode</p>
                <p className="text-xs text-text-muted">Block non-admin access to the platform</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={(e) => update('maintenance_mode', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
            </label>
          </div>
        </Surface>

        <Surface padding="default">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Defaults</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-primary mb-1">Default Org Quality Threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.default_org_quality_threshold}
                onChange={(e) => update('default_org_quality_threshold', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-24 rounded-lg border border-border bg-panel-muted px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-text-primary mb-1">Max Orgs Per User</label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.max_orgs_per_user}
                onChange={(e) => update('max_orgs_per_user', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-lg border border-border bg-panel-muted px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>
        </Surface>

        <Surface padding="default">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Session & Security</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-primary mb-1">Admin Session Timeout (minutes)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.admin_session_timeout_minutes}
                onChange={(e) => update('admin_session_timeout_minutes', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-lg border border-border bg-panel-muted px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-text-primary mb-1">OTP Expiry (minutes)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.otp_expiry_minutes}
                onChange={(e) => update('otp_expiry_minutes', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-lg border border-border bg-panel-muted px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>
        </Surface>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {dirty && <Badge variant="warning">Unsaved changes</Badge>}
      </div>
    </div>
  );
}
