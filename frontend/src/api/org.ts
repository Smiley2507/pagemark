import api from './client';
import type { Organization, OrgMember, OrgJoinLink, AuditLog, OrgMemberRole, PendingInvite } from '../types';

export const orgApi = {
  listOrganizations: () => 
    api.get<Organization[]>('/organizations').then(res => res.data),
    
  createOrganization: (name: string, avatar_url?: string) =>
    api.post<Organization>('/organizations', { name, avatar_url }).then(res => res.data),

  listMembers: (orgId: number, params?: { search?: string; role?: string; status?: string }) =>
    api.get<OrgMember[]>(`/organizations/${orgId}/members`, { params }).then(res => res.data),

  inviteMember: (orgId: number, email: string, role: OrgMemberRole) =>
    api.post(`/organizations/${orgId}/invites`, { email, role }).then(res => res.data),

  listPendingInvites: () =>
    api.get<PendingInvite[]>('/organizations/invites/pending').then(res => res.data),

  acceptInvite: (token: string) =>
    api.post(`/organizations/invites/${token}/accept`).then(res => res.data),

  rejectInvite: (token: string) =>
    api.post(`/organizations/invites/${token}/reject`).then(res => res.data),

  cancelInvite: (orgId: number, userId: number) =>
    api.delete(`/organizations/${orgId}/invites/${userId}`).then(res => res.data),

  resendInvite: (orgId: number, userId: number) =>
    api.post(`/organizations/${orgId}/invites/${userId}/resend`).then(res => res.data),

  updateMemberRole: (orgId: number, userId: number, role: OrgMemberRole) =>
    api.put<OrgMember>(`/organizations/${orgId}/members/${userId}`, { role }).then(res => res.data),

  removeMember: (orgId: number, userId: number) =>
    api.delete(`/organizations/${orgId}/members/${userId}`).then(res => res.data),

  updateOrganization: (orgId: number, data: {
    name?: string;
    avatar_url?: string;
    quality_threshold?: number;
  }) => api.patch<Organization>(`/organizations/${orgId}`, data).then(res => res.data),

  listAuditLogs: (
    orgId: number,
    page: number = 1,
    perPage: number = 50,
    params?: { search?: string; action?: string; source?: string; sort?: string },
  ) =>
    api.get<AuditLog[]>(`/organizations/${orgId}/audit-logs`, {
      params: { page, per_page: perPage, ...params },
    }).then(res => res.data),

  createJoinLink: (orgId: number, data: { role?: OrgMemberRole; max_uses?: number; expires_in_days?: number }) =>
    api.post<OrgJoinLink>(`/organizations/${orgId}/join-links`, data).then(res => res.data),

  listJoinLinks: (orgId: number) =>
    api.get<OrgJoinLink[]>(`/organizations/${orgId}/join-links`).then(res => res.data),

  revokeJoinLink: (orgId: number, linkId: number) =>
    api.post(`/organizations/${orgId}/join-links/${linkId}/revoke`).then(res => res.data),

  deleteJoinLink: (orgId: number, linkId: number) =>
    api.delete(`/organizations/${orgId}/join-links/${linkId}`).then(res => res.data),

  acceptJoinLink: (code: string) =>
    api.post(`/organizations/join-links/${code}/accept`).then(res => res.data),
};
