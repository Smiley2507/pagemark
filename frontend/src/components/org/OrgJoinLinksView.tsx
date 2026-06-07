import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import type { OrgMemberRole, OrgJoinLink } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Link,
  Plus,
  Copy,
  Check,
  X,
  Clock,
  Users,
  ShieldCheck,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

const ROLES: { value: OrgMemberRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'TECHNICAL_WRITER', label: 'Technical Writer' },
  { value: 'VIEWER', label: 'Viewer' },
];

export const OrgJoinLinksView: React.FC = () => {
  const { activeOrgId, currentRole } = useOrgStore();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState<OrgMemberRole>('DEVELOPER');
  const [maxUses, setMaxUses] = useState('');
  const [expiresDays, setExpiresDays] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isAdmin = currentRole === 'ADMIN';

  const {
    data: links,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['org-join-links', activeOrgId],
    queryFn: () => (activeOrgId ? orgApi.listJoinLinks(activeOrgId) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

  const createMutation = useMutation({
    mutationFn: () => orgApi.createJoinLink(activeOrgId!, {
      role: newRole,
      max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
      expires_in_days: expiresDays ? parseInt(expiresDays, 10) : undefined,
    }),
    onSuccess: () => {
      toast.success('Join link created');
      setIsCreateOpen(false);
      setNewRole('DEVELOPER');
      setMaxUses('');
      setExpiresDays('');
      queryClient.invalidateQueries({ queryKey: ['org-join-links', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create join link'),
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: number) => orgApi.revokeJoinLink(activeOrgId!, linkId),
    onSuccess: () => {
      toast.success('Join link revoked');
      queryClient.invalidateQueries({ queryKey: ['org-join-links', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to revoke join link'),
  });

  const copyToClipboard = async (code: string) => {
    const url = `${window.location.origin}/org/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const isActive = (link: OrgJoinLink) => {
    if (link.revoked_at) return false;
    if (link.expires_at && new Date(link.expires_at) < new Date()) return false;
    if (link.max_uses != null && link.use_count >= link.max_uses) return false;
    return true;
  };

  if (!activeOrgId) return <div className="text-muted-foreground">No organization selected</div>;

  if (isLoading) return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  if (isError) return <div className="text-destructive">Error loading join links.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Join Links</h3>
          <p className="text-meta text-muted-foreground mt-0.5">
            Shareable links that let anyone join your organization
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Join Link</DialogTitle>
                <DialogDescription>
                  Create a shareable link that lets anyone join your organization.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
                className="space-y-4 pt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="join-role">Default Role</Label>
                  <Select
                    id="join-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as OrgMemberRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-max-uses">Max Uses (optional)</Label>
                  <Input
                    id="join-max-uses"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-expires">Expires In (days, optional)</Label>
                  <Input
                    id="join-expires"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Never"
                    value={expiresDays}
                    onChange={(e) => setExpiresDays(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Link'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {links && links.length > 0 ? (
        <Surface variant="panel" padding="none" className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {links.map((link) => {
                const active = isActive(link);
                return (
                  <tr key={link.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {active ? (
                          <Link className="h-3.5 w-3.5 shrink-0 text-status-success-foreground" />
                        ) : (
                          <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <code className="text-meta font-mono truncate max-w-60 block">
                          {window.location.origin}/org/join/{link.code}
                        </code>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {ROLES.find((r) => r.value === link.role)?.label}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={active ? 'success' : 'neutral'} showIcon={false}>
                        {active ? 'Active' : link.revoked_at ? 'Revoked' : 'Expired'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {link.max_uses != null
                        ? `${link.use_count} / ${link.max_uses}`
                        : `${link.use_count}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {link.expires_at
                        ? new Date(link.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => copyToClipboard(link.code)}
                          title="Copy link"
                        >
                          {copiedCode === link.code ? (
                            <Check className="h-4 w-4 text-status-success-foreground" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {active && isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Revoke this join link? It will no longer be usable.')) {
                                revokeMutation.mutate(link.id);
                              }
                            }}
                            title="Revoke link"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Surface>
      ) : (
        <EmptyState
          icon={Link}
          title="No join links"
          description="Create a shareable link that lets people join your organization with a single click."
          action={
            isAdmin ? (
              <Button size="sm" className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Join Link
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
};
