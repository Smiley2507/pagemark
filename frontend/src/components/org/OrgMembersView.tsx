import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { useAuthStore } from '@/store/authStore';
import { orgApi } from '@/api/org';
import type { OrgMemberRole, OrgMember } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Trash2, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/dashboard/DashboardViews';

export const OrgMembersView: React.FC = () => {
  const { activeOrgId, currentRole } = useOrgStore();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('DEVELOPER');

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['org-members', activeOrgId],
    queryFn: () => (activeOrgId ? orgApi.listMembers(activeOrgId) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

  const inviteMutation = useMutation({
    mutationFn: () => orgApi.inviteMember(activeOrgId!, inviteEmail, inviteRole),
    onSuccess: () => {
      toast.success('Invitation sent successfully');
      setIsInviteOpen(false);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send invitation'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: OrgMemberRole }) =>
      orgApi.updateMemberRole(activeOrgId!, userId, role),
    onSuccess: () => {
      toast.success('Member role updated');
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update role'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => orgApi.removeMember(activeOrgId!, userId),
    onSuccess: () => {
      toast.success('Member removed from organization');
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to remove member'),
  });

  const isAdmin = currentRole === 'ADMIN' || currentRole === 'PROJECT_MANAGER';

  if (!activeOrgId) return <div className="p-6 text-muted-foreground">No organization selected</div>;
  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  );
  if (isError) return <div className="p-6 text-destructive">Error loading members. Please try again.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section font-semibold">Organization Members</h2>
          <p className="text-meta text-muted-foreground">Manage users and their permissions within this organization</p>
        </div>
        {isAdmin && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Member</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inviteMutation.mutate();
                }}
                className="space-y-4 pt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgMemberRole)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="TECHNICAL_WRITER">Technical Writer</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members && members.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.user_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.user_name}`}
                        alt={member.user_name}
                        className="h-8 w-8 rounded-full bg-muted"
                      />
                      <div>
                        <div className="font-medium">{member.user_name}</div>
                        <div className="text-meta text-muted-foreground">{member.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                      {member.role.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => updateRoleMutation.mutate({ userId: member.user_id, role: e.target.value as OrgMemberRole })}
                          className="h-8 rounded border border-border bg-background px-2 text-xs"
                          disabled={member.user_id === user?.id}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="PROJECT_MANAGER">Project Manager</option>
                          <option value="DEVELOPER">Developer</option>
                          <option value="TECHNICAL_WRITER">Technical Writer</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove ${member.user_name} from the organization?`)) {
                              removeMemberMutation.mutate(member.user_id);
                            }
                          }}
                          disabled={member.user_id === user?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No members found"
          description="Your organization doesn't have any members yet."
          actionLabel="Invite Member"
          onAction={() => setIsInviteOpen(true)}
          icon={Users}
        />
      )}
    </div>
  );
};
