import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { aiCredentialsApi } from "@/api/aiCredentials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Surface } from "@/components/ui/surface";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useAiProviderCatalog,
  useAiCredentials,
  useAiProviderModels,
  useUpsertAiCredential,
  useActivateAiCredential,
  useDeleteAiCredential,
} from "@/hooks/useAiCredentials";
import type { AiCredential, AiModelOption, AiProviderCatalogItem } from "@/types";

type CredentialByProvider = Record<string, AiCredential>;

function ProviderCard({
  provider,
  saved,
}: {
  provider: AiProviderCatalogItem;
  saved?: AiCredential;
}) {
  const queryClient = useQueryClient();
  const upsert = useUpsertAiCredential();
  const activate = useActivateAiCredential();
  const remove = useDeleteAiCredential();
  const [keyDraft, setKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [loadedModels, setLoadedModels] = useState<AiModelOption[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const liveModels = useAiProviderModels(provider.id, Boolean(saved));
  const models = loadedModels ?? liveModels.data?.models ?? provider.models;
  const modelId = modelDraft || saved?.model_id || models[0]?.id || "";
  const activeModelExists = models.some((model) => model.id === modelId);
  const selectedModel = activeModelExists ? modelId : models[0]?.id ?? "";

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await queryClient.fetchQuery({
        queryKey: ["ai-provider-models", provider.id],
        queryFn: () => aiCredentialsApi.getModels(provider.id),
      });
      setLoadedModels(response.models);
      if (!response.models.some((model) => model.id === selectedModel)) {
        setModelDraft(response.models[0]?.id ?? "");
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  const saveProvider = async () => {
    try {
      await upsert.mutateAsync({
        provider: provider.id,
        api_key: keyDraft,
        model_id: selectedModel,
      });
      setKeyDraft("");
      await loadModels();
    } catch {
      // Mutation hook owns the user-facing error toast.
    }
  };

  return (
    <Surface variant={saved?.is_active ? "muted" : "panel"} padding="default" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-body font-semibold text-text-primary">{provider.label}</h4>
            {saved?.is_active && <Badge variant="success">Active</Badge>}
          </div>
          <p className="text-meta-sm text-text-secondary">
            {saved ? `Saved key ends in ${saved.key_hint}` : "Not connected"}
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2">
            {!saved.is_active && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => activate.mutate(saved.id)}
                disabled={activate.isPending}
              >
                Set active
              </Button>
            )}
            <Tooltip content="Refresh models">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void loadModels()}
                disabled={isLoadingModels || liveModels.isFetching}
                aria-label={`Refresh ${provider.label} models`}
              >
                <RefreshCw className={isLoadingModels || liveModels.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </Tooltip>
            <Tooltip content="Remove key">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (window.confirm(`Remove ${provider.label} API key?`)) {
                    remove.mutate(saved.id);
                  }
                }}
                disabled={remove.isPending}
                aria-label={`Remove ${provider.label} key`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`model-${provider.id}`}>Model</Label>
          <Select
            id={`model-${provider.id}`}
            value={selectedModel}
            onChange={(event) => setModelDraft(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`key-${provider.id}`}>
            {saved ? "Replace API key" : "API key"}
          </Label>
          <Input
            id={`key-${provider.id}`}
            type="password"
            placeholder={saved ? "Enter new key to replace" : "Paste API key"}
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta-sm text-text-secondary">
          {saved && liveModels.data ? "Models loaded." : "Models refresh after validation."}
        </p>
        <Button
          size="sm"
          onClick={() => void saveProvider()}
          disabled={!keyDraft.trim() || !selectedModel || upsert.isPending}
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </Surface>
  );
}

export function AiProvidersSection() {
  const { data: catalog, isLoading: catalogLoading } = useAiProviderCatalog();
  const { data: credsData, isLoading: credsLoading } = useAiCredentials();

  const credByProvider = useMemo<CredentialByProvider>(() => {
    const map: CredentialByProvider = {};
    for (const credential of credsData?.credentials ?? []) {
      map[credential.provider] = credential;
    }
    return map;
  }, [credsData]);

  if (catalogLoading || credsLoading) {
    return (
      <Surface variant="panel" padding="lg">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          <span className="text-meta text-text-secondary">Loading AI providers</span>
        </div>
      </Surface>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 h-5 w-5 text-interaction" />
        <div className="space-y-1">
          <h3 className="text-section font-semibold text-text-primary">AI providers</h3>
          <p className="text-meta text-text-secondary">
            Keys are encrypted at rest. Saved providers refresh their available models automatically.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {(catalog ?? []).map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            saved={credByProvider[provider.id]}
          />
        ))}
      </div>

      {!credsData?.has_active && (credsData?.credentials.length ?? 0) > 0 && (
        <Badge variant="warning">
          Select an active provider before running provider-consuming actions.
        </Badge>
      )}
    </div>
  );
}
