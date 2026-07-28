import api from './client';
import type { APIKey } from '../types';

export const keysApi = {
  listAPIKeys: () => 
    api.get<APIKey[]>('/users/api-keys').then(res => res.data),
    
  createAPIKey: (name: string, expires_at?: string) =>
    api.post<APIKey>('/users/api-keys', { name, expires_at }).then(res => res.data),

  revokeAPIKey: (keyId: number) =>
    api.delete(`/users/api-keys/${keyId}`).then(res => res.data),
};
