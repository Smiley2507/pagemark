import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { aiCredentialsApi } from '@/api/aiCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { Surface } from '@/components/ui/surface';

interface ProviderCredentialSetupProps {
  actionLabel?: string;
  onComplete: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export function ProviderCredentialSetup({
  actionLabel = 'the selected AI-powered action',
  onComplete,
  onCancel,
  embedded = true,
}: ProviderCredentialSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const queryClient = useQueryClient();

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['ai-provider-catalog'],
    queryFn: () => aiCredentialsApi.getCatalog(),
  });

  const providerDefinition = catalog.find((provider) => provider.id === selectedProvider);

  useEffect(() => {
    if (providerDefinition && providerDefinition.models.length > 0 && !selectedModel) {
      setSelectedModel(providerDefinition.models[0].id);
    }
  }, [providerDefinition, selectedModel]);

  const configureProvider = useMutation({
    mutationFn: ({ provider, model, key }: { provider: string; model: string; key: string }) =>
      aiCredentialsApi.upsert(provider, { api_key: key, model_id: model }),
    onSuccess: async (credential) => {
      await aiCredentialsApi.activate(credential.id);
      await queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
      toast.success('Provider credential configured');
      onComplete();
    },
    onError: (error: Error) => {
      toast.error(`Provider setup failed: ${error.message}`);
    },
  });

  return (
    <Surface variant={embedded ? 'panel' : 'canvas'} padding="lg" className="space-y-5">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-interaction" />
        <div>
          <h2 className="text-body font-semibold text-text-primary">Configure a provider in-flow</h2>
          <p className="mt-1 text-meta text-text-secondary">
            Your API key is needed for {actionLabel}. It's encrypted before storage.
          </p>
        </div>
      </div>

      <Notice variant="info" title="Security">
        Your API key is encrypted before storage. Usage estimates are approximate, not guaranteed billing.
      </Notice>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedProvider || !selectedModel || !apiKey) return;
          configureProvider.mutate({
            provider: selectedProvider,
            model: selectedModel,
            key: apiKey,
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select
            id="provider"
            value={selectedProvider}
            onChange={(event) => {
              setSelectedProvider(event.target.value);
              setSelectedModel('');
            }}
            disabled={isLoading}
          >
            <option value="">Select a provider</option>
            {catalog.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </Select>
        </div>

        {providerDefinition && (
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              id="model"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              {providerDefinition.models.length > 0 ? (
                providerDefinition.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))
              ) : (
                <option value="" disabled>No models available</option>
              )}
            </Select>
          </div>
        )}

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="provider-key">API key</Label>
            <Input
              id="provider-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste provider key"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={!selectedProvider || !selectedModel || !apiKey || configureProvider.isPending}
          >
            {configureProvider.isPending ? 'Configuring provider…' : 'Save provider and continue'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Continue without provider
            </Button>
          )}
        </div>
      </form>
    </Surface>
  );
}
