import axios from 'axios';
import apiClient from './client';

let adminAxiosInstance: ReturnType<typeof axios.create> | null = null;

function getAdminClient() {
  if (!adminAxiosInstance) {
    adminAxiosInstance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return adminAxiosInstance;
}

export function setAdminToken(token: string) {
  getAdminClient().defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAdminToken() {
  if (adminAxiosInstance) {
    delete adminAxiosInstance.defaults.headers.common['Authorization'];
  }
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  requires_otp: boolean;
  message: string;
}

export interface AdminVerifyOtpRequest {
  email: string;
  code: string;
}

export interface AdminVerifyOtpResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export interface AdminMeResponse {
  id: number;
  email: string;
  name: string | null;
  is_superuser: boolean;
}

export interface SystemStats {
  total_users: number;
  total_organizations: number;
  total_projects: number;
  total_documents: number;
  active_users_last_24h: number;
  active_users_last_7d: number;
  active_users_last_30d: number;
  documents_generated: number;
  pending_superuser_requests: number;
}

export interface GrowthDataPoint {
  date: string;
  users: number;
  organizations: number;
  projects: number;
  documents: number;
}

export interface GrowthDataResponse {
  data: GrowthDataPoint[];
}

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  is_verified: boolean;
  is_superuser: boolean;
  is_suspended: boolean;
  login_count: number;
  created_at: string;
  updated_at: string | null;
  organization_count: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserUpdate {
  is_suspended?: boolean;
  is_superuser?: boolean;
  name?: string;
}

export interface AdminOrganization {
  id: number;
  name: string;
  slug: string;
  personal: boolean;
  quality_threshold: number;
  created_by: number;
  created_at: string;
  member_count: number;
  project_count: number;
}

export interface AdminOrganizationListResponse {
  organizations: AdminOrganization[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminOrganizationUpdate {
  name?: string;
  quality_threshold?: number;
  is_suspended?: boolean;
}

export interface SystemSettings {
  allow_public_signup: boolean;
  default_org_quality_threshold: number;
  maintenance_mode: boolean;
  max_orgs_per_user: number;
  admin_session_timeout_minutes: number;
  otp_expiry_minutes: number;
}

export interface SystemSettingsUpdate {
  allow_public_signup?: boolean;
  default_org_quality_threshold?: number;
  maintenance_mode?: boolean;
  max_orgs_per_user?: number;
  admin_session_timeout_minutes?: number;
  otp_expiry_minutes?: number;
}

export interface AdminActivityEvent {
  id: number;
  event_type: string;
  message: string | null;
  user_id: number | null;
  user_name: string | null;
  project_id: number | null;
  project_name: string | null;
  organization_id: number | null;
  organization_name: string | null;
  created_at: string;
}

export interface AdminActivityResponse {
  events: AdminActivityEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface SuperuserRequest {
  id: number;
  email: string;
  name: string | null;
  justification: string | null;
  status: string;
  reviewer_id: number | null;
  reviewed_at: string | null;
  created_at: string;
}

const _api = apiClient;
const _admin = () => getAdminClient();

export const adminApi = {
  async login(data: AdminLoginRequest): Promise<AdminLoginResponse> {
    const res = await _api.post('/admin/auth/login', data);
    return res.data;
  },

  async verifyOtp(data: AdminVerifyOtpRequest): Promise<AdminVerifyOtpResponse> {
    const res = await _api.post('/admin/auth/verify-otp', data);
    return res.data;
  },

  async me(): Promise<AdminMeResponse> {
    const res = await _admin().get('/admin/auth/me');
    return res.data;
  },

  async requestSignup(data: { email: string; name?: string; justification?: string }): Promise<void> {
    await _api.post('/admin/auth/request-signup', data);
  },

  async getPendingRequests(): Promise<SuperuserRequest[]> {
    const res = await _admin().get('/admin/auth/pending-requests');
    return res.data;
  },

  async approveRequest(requestId: number): Promise<void> {
    await _admin().post(`/admin/auth/approve-request/${requestId}`, { action: 'approve' });
  },

  async rejectRequest(requestId: number): Promise<void> {
    await _admin().post(`/admin/auth/approve-request/${requestId}`, { action: 'reject' });
  },

  async logout(): Promise<void> {
    await _admin().post('/admin/auth/logout');
  },

  async getStats(): Promise<SystemStats> {
    const res = await _admin().get('/admin/stats');
    return res.data;
  },

  async getGrowthData(days: number = 30): Promise<GrowthDataResponse> {
    const res = await _admin().get(`/admin/stats/growth?days=${days}`);
    return res.data;
  },

  async listUsers(params?: { search?: string; page?: number; page_size?: number }): Promise<AdminUserListResponse> {
    const res = await _admin().get('/admin/users', { params });
    return res.data;
  },

  async getUser(userId: number): Promise<AdminUser> {
    const res = await _admin().get(`/admin/users/${userId}`);
    return res.data;
  },

  async updateUser(userId: number, data: AdminUserUpdate): Promise<AdminUser> {
    const res = await _admin().patch(`/admin/users/${userId}`, data);
    return res.data;
  },

  async listOrganizations(params?: { search?: string; page?: number; page_size?: number }): Promise<AdminOrganizationListResponse> {
    const res = await _admin().get('/admin/organizations', { params });
    return res.data;
  },

  async getOrganization(orgId: number): Promise<AdminOrganization> {
    const res = await _admin().get(`/admin/organizations/${orgId}`);
    return res.data;
  },

  async updateOrganization(orgId: number, data: AdminOrganizationUpdate): Promise<AdminOrganization> {
    const res = await _admin().patch(`/admin/organizations/${orgId}`, data);
    return res.data;
  },

  async getSettings(): Promise<SystemSettings> {
    const res = await _admin().get('/admin/settings');
    return res.data;
  },

  async updateSettings(data: SystemSettingsUpdate): Promise<SystemSettings> {
    const res = await _admin().patch('/admin/settings', data);
    return res.data;
  },

  async getActivity(params?: {
    page?: number; page_size?: number; event_type?: string;
    user_id?: number; org_id?: number; days?: number;
  }): Promise<AdminActivityResponse> {
    const res = await _admin().get('/admin/activity', { params });
    return res.data;
  },

  async getEventTypes(): Promise<{ event_type: string; count: number }[]> {
    const res = await _admin().get('/admin/activity/event-types');
    return res.data;
  },
};
