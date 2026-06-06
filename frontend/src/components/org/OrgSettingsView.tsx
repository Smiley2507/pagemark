import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';
import { orgApi } from '@/api/org';
import { useOrgStore } from '@/store/orgStore';

export const OrgSettingsView: React.FC = () => {
  const { activeOrgId, getActiveOrg, setOrganizations } = useOrgStore();
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAvatar, setOrgAvatar] = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(70);

  const activeOrg = getActiveOrg();

  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name);
      setOrgAvatar(activeOrg.avatar_url || '');
      setQualityThreshold((activeOrg as any).quality_threshold ?? 70);
    }
  }, [activeOrg]);

  const refreshOrganizations = async () => {
    const orgs = await orgApi.listOrganizations();
    setOrganizations(orgs);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeOrgId) return;
    try {
      await orgApi.updateOrganization(activeOrgId, {
        name: orgName,
        avatar_url: orgAvatar,
      });
      await refreshOrganizations();
      toast.success('Organization updated');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update organization');
    }
  };

  const handleQualityThresholdSave = async () => {
    if (!activeOrgId) return;
    try {
      await orgApi.updateOrganization(activeOrgId, { quality_threshold: qualityThreshold });
      await refreshOrganizations();
      toast.success('Quality threshold updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update quality threshold');
    }
  };

  if (!activeOrgId) {
    return <p className="text-body text-text-secondary">No organization selected.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Surface variant="panel" padding="lg" className="space-y-5">
        <div className="flex items-center gap-4">
          {orgAvatar ? (
            <img
              src={orgAvatar}
              alt=""
              className="h-16 w-16 object-cover"
            />
          ) : (
            <Surface variant="muted" className="flex h-16 w-16 items-center justify-center">
              <span className="text-section font-semibold text-text-secondary">
                {orgName.slice(0, 1).toUpperCase()}
              </span>
            </Surface>
          )}
          <div>
            <h3 className="text-body font-semibold text-text-primary">{activeOrg?.name}</h3>
            <p className="text-meta text-text-secondary">{activeOrg?.slug}</p>
          </div>
        </div>

        {!isEditing ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit profile
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-avatar">Avatar URL</Label>
              <Input
                id="org-avatar"
                value={orgAvatar}
                onChange={(event) => setOrgAvatar(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div>
          <h3 className="text-body font-semibold text-text-primary">Quality threshold</h3>
          <p className="text-meta text-text-secondary">
            Documents below this score show a quality warning.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={qualityThreshold}
            onChange={(event) => setQualityThreshold(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary"
            aria-label="Documentation quality threshold"
          />
          <span className="w-12 text-right text-body font-semibold tabular-nums text-text-primary">
            {qualityThreshold}%
          </span>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleQualityThresholdSave}
            disabled={qualityThreshold === ((activeOrg as any)?.quality_threshold ?? 70)}
          >
            Save threshold
          </Button>
        </div>
      </Surface>
    </div>
  );
};
