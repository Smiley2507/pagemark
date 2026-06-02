import api from './client';
import type { Organization, OrgMember, AuditLog } from '../types';

export const orgApi = {
  listOrganizations: () => 
    api.get<Organization[]>('/organizations').then(res => res.data),
    
  createOrganization: (name: string, avatar_url?: string) =>
    api.post<Organization>('/organizations', { name, avatar_url }).then(res => res.data),

  listMembers: (orgId: number) =>
    api.get<OrgMember[]>(`/organizations/${orgId}/members`).then(res => res.data),

  inviteMember: (orgId: number, email: string, role: string) =>
    api.post(`/organizations/${orgId}/invites`, { email, role }).then(res => res.data),

  acceptInvite: (token: string) =>
    api.post(`/organizations/invites/${token}/accept`).then(res => res.data),

  updateMemberRole: (orgId: number, userId: number, role: string) =>
    api.put<OrgMember>(`/organizations/${orgId}/members/${userId}`, { role }).then(res => res.data),

  removeMember: (orgId: number, userId: number) =>
    api.delete(`/organizations/${orgId}/members/${userId}`).then(res => res.data),

  updateOrganization: (orgId: number, data: { name: string; avatar_url?: string }) =>
    api.patch<Organization>(`/organizations/${orgId}`, data).then(res => res.data),

  listAuditLogs: (orgId: number, page: number = 1, perPage: number = 50) =>
    api.get<AuditLog[]>(`/organizations/${orgId}/audit-logs`, { params: { page, per_page: perPage } }).then(res => res.data),
};
