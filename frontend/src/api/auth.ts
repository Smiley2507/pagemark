import apiClient from './client';
import type { User } from '../types';

export interface LoginResponse {
  requires_otp: boolean;
  user?: User;
  message?: string;
}

export interface MfaSettings {
  mfa_enabled: boolean;
}

export const authApi = {
  async register(registerData: { email: string; password: string; name: string; organization_name?: string }): Promise<User> {
    const { data } = await apiClient.post('/auth/register', registerData);
    return data;
  },

  async login(loginData: { email: string; password: string }): Promise<LoginResponse> {
    const { data } = await apiClient.post('/auth/login', loginData);
    return data;
  },

  async verifyMfa(email: string, code: string): Promise<User> {
    const { data } = await apiClient.post('/auth/verify-mfa', { email, code });
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  async updateMe(payload: { name?: string; avatar_url?: string; password?: string }): Promise<User> {
    const { data } = await apiClient.patch('/auth/me', payload);
    return data;
  },

  async refreshSession(): Promise<void> {
    await apiClient.post('/auth/refresh');
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, new_password: password });
  },

  async getMfaSettings(): Promise<MfaSettings> {
    const { data } = await apiClient.get('/auth/me/mfa');
    return data;
  },

  async enableMfa(): Promise<{ message: string }> {
    const { data } = await apiClient.post('/auth/me/mfa/enable', {});
    return data;
  },

  async verifyEnableMfa(code: string): Promise<MfaSettings> {
    const { data } = await apiClient.post('/auth/me/mfa/verify-enable', { code });
    return data;
  },

  async disableMfa(): Promise<MfaSettings> {
    const { data } = await apiClient.post('/auth/me/mfa/disable');
    return data;
  },
};
