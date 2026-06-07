import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { Surface } from '@/components/ui/surface';
import { Badge } from '@/components/ui/badge';
import { Users, Link, UserPlus } from 'lucide-react';
import { OrgMembersView } from '@/components/org/OrgMembersView';
import { OrgJoinLinksView } from '@/components/org/OrgJoinLinksView';

export function MembersPage() {
  const { activeOrgId } = useOrgStore();

  const { data: members } = useQuery({
    queryKey: ['org-members', activeOrgId],
    queryFn: () => (activeOrgId ? orgApi.listMembers(activeOrgId) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

  const pendingInvites = members?.filter((m) => m.status === 'INVITED') ?? [];
  const activeCount = members?.filter((m) => m.status === 'ACTIVE')?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold text-text-primary">Members</h1>
        <p className="text-meta text-text-muted mt-1">
          Manage your organization members, invites, and join links
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Surface variant="panel" padding="default" className="flex items-center gap-3 min-w-40">
          <Users className="h-5 w-5 text-text-muted shrink-0" />
          <div>
            <p className="text-meta text-text-muted">Active Members</p>
            <p className="text-section font-semibold text-text-primary">{activeCount}</p>
          </div>
        </Surface>
        <Surface variant="panel" padding="default" className="flex items-center gap-3 min-w-40">
          <UserPlus className="h-5 w-5 text-text-muted shrink-0" />
          <div>
            <p className="text-meta text-text-muted">Pending Invites</p>
            <p className="text-section font-semibold text-text-primary">
              {pendingInvites.length}
            </p>
          </div>
        </Surface>
        <Surface variant="panel" padding="default" className="flex items-center gap-3 min-w-40">
          <Link className="h-5 w-5 text-text-muted shrink-0" />
          <div>
            <p className="text-meta text-text-muted">Join Links</p>
            <p className="text-section font-semibold text-text-primary">&mdash;</p>
          </div>
        </Surface>
      </div>

      <OrgMembersView />

      {pendingInvites.length > 0 && (
        <Surface variant="panel" padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-separator">
            <h2 className="text-sm font-semibold text-text-primary">Pending Invitations</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted border-b border-separator">
              <tr>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {pendingInvites.map((invite) => (
                <tr key={invite.id}>
                  <td className="px-4 py-2.5 text-text-primary">{invite.user_email}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Badge variant="neutral" showIcon={false}>
                        {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="warning" showIcon={false}>
                      Pending
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-muted text-meta">
                    Awaiting acceptance
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}

      <OrgJoinLinksView />
    </div>
  );
}
