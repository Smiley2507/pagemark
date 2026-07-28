import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/store/orgStore';
import { orgApi } from '@/api/org';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrgMembersView } from '@/components/org/OrgMembersView';
import { OrgJoinLinksView } from '@/components/org/OrgJoinLinksView';

export function MembersPage() {
  const { activeOrgId } = useOrgStore();
  const [activeTab, setActiveTab] = useState('members');

  const { data: members } = useQuery({
    queryKey: ['org-members', activeOrgId],
    queryFn: () => (activeOrgId ? orgApi.listMembers(activeOrgId) : Promise.reject('No active org')),
    enabled: !!activeOrgId,
  });

  const pendingInvites = members?.filter((m) => m.status === 'INVITED') ?? [];
  const activeCount = members?.filter((m) => m.status === 'ACTIVE')?.length ?? 0;

  return (
    <div className="space-y-6 px-6 py-6">
      <Surface variant="panel" padding="none" className="overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-separator px-5 py-4">
            <h1 className="text-section font-semibold text-text-primary">Members</h1>
            <p className="text-meta text-text-muted mt-1">
              Manage your organization members, invites, and join links
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-separator px-5 py-3">
            <Badge variant="neutral" showIcon={false}>
              {activeCount} active members
            </Badge>
            {pendingInvites.length > 0 && (
              <Badge variant="info" showIcon={false}>
                {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="border-b border-separator px-5 py-3">
            <TabsList className="w-fit">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invites">Invites</TabsTrigger>
            </TabsList>
          </div>

          <div className="bg-panel-muted/55 p-3">
            <TabsContent value="members" className="mt-0">
              <OrgMembersView />
            </TabsContent>

            <TabsContent value="invites" className="mt-0 space-y-6">
              {pendingInvites.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="text-text-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Email</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingInvites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="px-4 py-2.5 text-text-primary">{invite.user_email}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="neutral" showIcon={false}>
                            {invite.role.charAt(0) + invite.role.slice(1).toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="info" showIcon={false}>
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
              ) : (
                <p className="text-body text-text-muted py-4">No pending invitations.</p>
              )}

              <OrgJoinLinksView />
            </TabsContent>
          </div>
        </Tabs>
      </Surface>
    </div>
  );
}
