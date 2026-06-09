import apiClient from './client';
import type {
  AiProviderCatalogItem,
  AiProviderModelsResponse,
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

  async getModels(provider: string): Promise<AiProviderModelsResponse> {
    const { data } = await apiClient.get<AiProviderModelsResponse>(
      `/auth/me/ai-credentials/${provider}/models`
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

  async testConnection(
    provider: string,
    body: { api_key: string; model_id: string }
  ): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/auth/me/ai-credentials/${provider}/test`,
      body
    );
    return data;
  },

  async remove(credentialId: number): Promise<void> {
    await apiClient.delete(`/auth/me/ai-credentials/${credentialId}`);
  },
};
