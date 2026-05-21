import apiClient from './client';
import type { User } from '../types';

export const authApi = {
  async register(registerData: { email: string; password: string; name: string }): Promise<User> {
    const { data } = await apiClient.post('/auth/register', registerData);
    return data;
  },

  async login(loginData: { email: string; password: string }): Promise<User> {
    const { data } = await apiClient.post('/auth/login', loginData);
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  },
};
