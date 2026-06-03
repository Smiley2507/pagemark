import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { toast } from 'sonner';

export const OrgSettingsView: React.FC = () => {
  const { activeOrgId, getActiveOrg } = useOrgStore();
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAvatar, setOrgAvatar] = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(70);

  const activeOrg = getActiveOrg();

  React.useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
      setOrgAvatar(activeOrg.avatar_url || '');
    }
  }, [activeOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await orgApi.updateOrganization(activeOrgId!, { name: orgName, avatar_url: orgAvatar });
      toast.success('Organization settings updated');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update organization settings');
    }
  };

  const handleQualityThresholdSave = async () => {
    try {
      await orgApi.updateOrganization(activeOrgId!, { quality_threshold: qualityThreshold });
      toast.success('Quality threshold updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update quality threshold');
    }
  };

  if (!activeOrgId) return <div className="p-6 text-muted-foreground">No organization selected</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-section font-semibold">Organization Settings</h1>
        <p className="text-meta text-muted-foreground">Manage your organization's public profile and general configuration</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <img
              src={orgAvatar || `https://api.dicebear.com/7.x/initials?seed=${orgName}`}
              alt="Org Avatar"
              className="h-24 w-24 rounded-2xl object-cover border border-border"
            />
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="text-white text-xs font-medium">Change</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium">{activeOrg?.name}</h3>
            <p className="text-meta text-muted-foreground">Organization Profile</p>
          </div>
        </div>

        {!isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Organization Name</p>
                  <p className="text-sm">{activeOrg?.name}</p>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Slug</p>
                  <p className="text-sm font-mono">{activeOrg?.slug}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-avatar">Avatar URL</Label>
              <Input
                id="org-avatar"
                value={orgAvatar}
                onChange={(e) => setOrgAvatar(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </div>

      {/* Quality Threshold */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium">Documentation Quality Threshold</h3>
          <p className="text-meta text-muted-foreground">Set the minimum quality score for documentation. Documents below this threshold will display a warning.</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={qualityThreshold}
            onChange={(e) => setQualityThreshold(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
          />
          <span className="text-lg font-bold tabular-nums w-12 text-right">{qualityThreshold}%</span>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleQualityThresholdSave}
            disabled={qualityThreshold === (activeOrg as any)?.quality_threshold}
          >
            Save Threshold
          </Button>
        </div>
      </div>
    </div>
  );
};
