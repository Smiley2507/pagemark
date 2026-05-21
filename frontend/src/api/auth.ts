import apiClient from './client';
import { User } from '../types';

export const authApi = {
  async register(data: { email: string; password: string; name: string }): Promise<User> {
    const { data } = await apiClient.post('/auth/register', data);
    return data;
  },

  async login(data: { email: string; password: string }): Promise<User> {
    const { data } = await apiClient.post('/auth/login', data);
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
