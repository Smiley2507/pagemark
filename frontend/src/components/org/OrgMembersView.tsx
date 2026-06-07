import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { useAuthStore } from '@/store/authStore';
import { orgApi } from '@/api/org';
import type { OrgMemberRole, OrgMemberStatus, OrgMember } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import {
  UserPlus,
  Trash2,
  ShieldCheck,
  Users,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const ROLES: { value: OrgMemberRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'TECHNICAL_WRITER', label: 'Technical Writer' },
  { value: 'VIEWER', label: 'Viewer' },
];

const STATUS_OPTIONS: { value: OrgMemberStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

function statusBadgeVariant(status: OrgMemberStatus): 'success' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'INVITED': return 'info';
    case 'SUSPENDED': return 'warning';
  }
}

function roleBadgeVariant(role: OrgMemberRole): 'neutral' | 'info' | 'success' | 'warning' | 'generation' {
  switch (role) {
    case 'ADMIN': return 'info';
    case 'PROJECT_MANAGER': return 'success';
    case 'DEVELOPER': return 'neutral';
    case 'TECHNICAL_WRITER': return 'generation';
    case 'VIEWER': return 'warning';
  }
}

export const OrgMembersView: React.FC = () => {
  const { activeOrgId, currentRole } = useOrgStore();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<OrgMemberRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<OrgMemberStatus | ''>('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>('DEVELOPER');

  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);

  const queryParams = useMemo(() => {
    const params: { search?: string; role?: string; status?: string } = {};
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;
    return params;
  }, [search, roleFilter, statusFilter]);

  const {
    data: members,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['org-members', activeOrgId, queryParams],
    queryFn: () => (activeOrgId ? orgApi.listMembers(activeOrgId, queryParams) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

  const inviteMutation = useMutation({
    mutationFn: () => orgApi.inviteMember(activeOrgId!, inviteEmail, inviteRole),
    onSuccess: () => {
      toast.success('Invitation sent successfully');
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteRole('DEVELOPER');
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
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to remove member'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (userId: number) => orgApi.resendInvite(activeOrgId!, userId),
    onSuccess: () => {
      toast.success('Invitation resent');
      queryClient.invalidateQueries({ queryKey: ['org-members', activeOrgId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to resend invitation'),
  });

  const isAdmin = currentRole === 'ADMIN';
  const canManage = currentRole === 'ADMIN' || currentRole === 'PROJECT_MANAGER';

  const clearFilters = useCallback(() => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
  }, []);

  const labelForRole = useCallback((role: OrgMemberRole) =>
    ROLES.find((r) => r.value === role)?.label || role, []);

  if (!activeOrgId) return <div className="p-6 text-muted-foreground">No organization selected</div>;

  if (isLoading) return (
    <div className="space-y-4 pt-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  if (isError) return <div className="p-6 text-destructive">Error loading members. Please try again.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section font-semibold">Organization Members</h2>
          <p className="text-meta text-muted-foreground mt-0.5">
            Manage who has access to this organization
          </p>
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
                  <Select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgMemberRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as OrgMemberRole | '')}
          className="w-40"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrgMemberStatus | '')}
          className="w-36"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        {(search || roleFilter || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {members && members.length > 0 ? (
        <Surface variant="panel" padding="none" className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.user_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${member.user_name}`}
                        alt={member.user_name}
                        className="h-8 w-8 rounded-full"
                      />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {member.user_name}
                          {member.user_id === user?.id && (
                            <span className="text-meta-sm text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <div className="text-meta text-muted-foreground">{member.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && member.user_id !== user?.id ? (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          updateRoleMutation.mutate({
                            userId: member.user_id,
                            role: e.target.value as OrgMemberRole,
                          })
                        }
                        fieldSize="sm"
                        className="w-40"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Badge variant={roleBadgeVariant(member.role)} showIcon={false}>
                          {labelForRole(member.role)}
                        </Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(member.status)}>
                      {member.status.charAt(0) + member.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {member.status === 'INVITED' && isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => resendInviteMutation.mutate(member.user_id)}
                            disabled={resendInviteMutation.isPending}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Resend
                          </Button>
                        )}
                        {member.user_id !== user?.id && isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setRemoveTarget(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      ) : (
        <EmptyState
          icon={Users}
          title={search || roleFilter || statusFilter ? 'No members match your filters' : 'No members found'}
          description={
            search || roleFilter || statusFilter
              ? 'Try adjusting your search or filters.'
              : 'Your organization doesn\'t have any members yet. Invite someone to get started.'
          }
          action={
            search || roleFilter || statusFilter ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : isAdmin ? (
              <Button size="sm" className="gap-2" onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Remove member"
        description={
          removeTarget
            ? `Are you sure you want to remove ${removeTarget.user_name} from the organization? They will lose access to all projects and documents.`
            : ''
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (removeTarget) removeMemberMutation.mutate(removeTarget.user_id);
        }}
      />
    </div>
  );
};
