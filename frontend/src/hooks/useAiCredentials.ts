import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiCredentialsApi } from '@/api/aiCredentials';

export const useAiProviderCatalog = () =>
  useQuery({
    queryKey: ['ai-provider-catalog'],
    queryFn: () => aiCredentialsApi.getCatalog(),
    staleTime: 60_000,
  });

export const useAiCredentials = () =>
  useQuery({
    queryKey: ['ai-credentials'],
    queryFn: () => aiCredentialsApi.list(),
  });

export const useAiProviderModels = (provider: string, enabled: boolean) =>
  useQuery({
    queryKey: ['ai-provider-models', provider],
    queryFn: () => aiCredentialsApi.getModels(provider),
    enabled: enabled && Boolean(provider),
    staleTime: 60_000,
  });

export const useUpsertAiCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      api_key,
      model_id,
    }: {
      provider: string;
      api_key: string;
      model_id: string;
    }) => aiCredentialsApi.upsert(provider, { api_key, model_id }),
    onSuccess: (credential) => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['ai-provider-models', credential.provider] });
      toast.success('API key saved and validated');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to save API key');
    },
  });
};

export const useActivateAiCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentialId: number) => aiCredentialsApi.activate(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
      toast.success('Active provider updated');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to activate provider');
    },
  });
};

export const useTestAiCredential = () =>
  useMutation({
    mutationFn: ({
      provider,
      api_key,
      model_id,
    }: {
      provider: string;
      api_key: string;
      model_id: string;
    }) => aiCredentialsApi.testConnection(provider, { api_key, model_id }),
  });

export const useDeleteAiCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentialId: number) => aiCredentialsApi.remove(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
      toast.success('API key removed');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to remove API key');
    },
  });
};
