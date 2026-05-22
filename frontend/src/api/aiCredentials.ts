import apiClient from './client';
import type {
  AiProviderCatalogItem,
  AiCredential,
  AiCredentialListResponse,
} from '../types';

export const aiCredentialsApi = {
  async getCatalog(): Promise<AiProviderCatalogItem[]> {
    const { data } = await apiClient.get<{ providers: AiProviderCatalogItem[] }>(
      '/auth/me/ai-providers/catalog'
    );
    return data.providers;
  },

  async list(): Promise<AiCredentialListResponse> {
    const { data } = await apiClient.get<AiCredentialListResponse>(
      '/auth/me/ai-credentials'
    );
    return data;
  },

  async upsert(
    provider: string,
    body: { api_key: string; model_id: string }
  ): Promise<AiCredential> {
    const { data } = await apiClient.put<AiCredential>(
      `/auth/me/ai-credentials/${provider}`,
      body
    );
    return data;
  },

  async activate(credentialId: number): Promise<AiCredential> {
    const { data } = await apiClient.post<AiCredential>(
      `/auth/me/ai-credentials/${credentialId}/activate`
    );
    return data;
  },

  async remove(credentialId: number): Promise<void> {
    await apiClient.delete(`/auth/me/ai-credentials/${credentialId}`);
  },
};
