import React, { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { aiCredentialsApi } from '@/api/aiCredentials';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ProviderCredentialSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export function ProviderCredentialSetup({
  onComplete,
  onCancel,
  embedded = true,
}: ProviderCredentialSetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const queryClient = useQueryClient();

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['ai-provider-catalog'],
    queryFn: () => aiCredentialsApi.getCatalog(),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ provider, model, key }: { provider: string; model: string; key: string }) =>
      aiCredentialsApi.upsert(provider, { api_key: key, model_id: model }),
    onSuccess: async (credential) => {
      // Activate the credential
      await aiCredentialsApi.activate(credential.id);
      await queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
      toast.success('AI provider configured successfully');
      onComplete();
    },
    onError: (error: Error) => {
      toast.error(`Failed to configure provider: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !selectedModel || !apiKey) return;
    upsertMutation.mutate({
      provider: selectedProvider,
      model: selectedModel,
      key: apiKey,
    });
  };

  const selectedProviderData = catalog.find((p) => p.id === selectedProvider);

  React.useEffect(() => {
    if (selectedProviderData && selectedProviderData.models.length > 0 && !selectedModel) {
      setSelectedModel(selectedProviderData.models[0].id);
    }
  }, [selectedProviderData, selectedModel]);

  return (
    <div className={embedded ? 'rounded-lg border border-separator bg-panel p-6 space-y-6' : 'space-y-6'}>
      <div className="flex items-start gap-3">
        <Shield className="h-6 w-6 text-interaction shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-body-lg font-semibold text-text-primary">Configure AI Provider</h3>
          <p className="text-body text-text-secondary mt-1">
            Your API key is encrypted and stored securely. It is never shared with anyone else.
          </p>
        </div>
      </div>

      <div className="rounded-md bg-status-info p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-status-info-foreground shrink-0 mt-0.5" />
          <div className="text-body text-status-info-foreground">
            <strong>Your own API key required:</strong> Pagemark uses your provider account for AI
            features. You control usage and costs directly with your chosen provider.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <select
            id="provider"
            value={selectedProvider}
            onChange={(e) => {
              setSelectedProvider(e.target.value);
              setSelectedModel('');
            }}
            disabled={isLoading}
            className="w-full h-9 px-3 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a provider...</option>
            {catalog.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        {selectedProviderData && (
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {selectedProviderData.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-meta text-text-muted">
              Get your API key from your provider's dashboard. It will be encrypted before storage.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={!selectedProvider || !selectedModel || !apiKey || upsertMutation.isPending}
          >
            {upsertMutation.isPending ? 'Configuring...' : 'Configure & Continue'}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
