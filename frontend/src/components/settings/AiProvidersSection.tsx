import { useMemo, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { aiCredentialsApi } from "@/api/aiCredentials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  useTestAiCredential,
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
  const testConn = useTestAiCredential();
  const activate = useActivateAiCredential();
  const remove = useDeleteAiCredential();
  const [keyDraft, setKeyDraft] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadedModels, setLoadedModels] = useState<AiModelOption[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const liveModels = useAiProviderModels(provider.id, Boolean(saved));
  const models = loadedModels ?? liveModels.data?.models ?? provider.models;
  const modelId = modelDraft || saved?.model_id || models[0]?.id || "";
  const activeModelExists = models.some((model) => model.id === modelId);
  const selectedModel = activeModelExists ? modelId : models[0]?.id ?? "";

  const hasEdits = keyDraft.trim() !== "";

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const loadModels = useCallback(async () => {
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
  }, [queryClient, provider.id, selectedModel]);

  const saveProvider = async () => {
    try {
      const cred = await upsert.mutateAsync({
        provider: provider.id,
        api_key: keyDraft,
        model_id: selectedModel,
      });
      setKeyDraft("");
      setSaveSuccess(true);
      await loadModels();
      if (!saved) {
        await activate.mutateAsync(cred.id);
      }
    } catch {
      // Error toast handled by mutation hook
    }
  };

  const testConnection = () => {
    testConn.mutate(
      { provider: provider.id, api_key: keyDraft || "", model_id: selectedModel },
      {
        onSuccess: () => {},
        onError: () => {},
      }
    );
  };

  const testResult = testConn.data || testConn.error
    ? {
        success: testConn.data?.success ?? false,
        message: testConn.data?.message ?? (testConn.error instanceof Error ? testConn.error.message : "Connection failed"),
      }
    : null;

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
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={remove.isPending}
                aria-label={`Remove ${provider.label} key`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
            <ConfirmDialog
              open={deleteConfirmOpen}
              onOpenChange={setDeleteConfirmOpen}
              title={`Remove ${provider.label} API key?`}
              description="This will disable AI generation using this provider. Saved documents and sections are not affected."
              confirmLabel="Remove"
              variant="destructive"
              onConfirm={() => remove.mutate(saved.id)}
            />
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success/5 px-3 py-2 text-meta-sm text-text-success">
          <Check className="h-4 w-4 shrink-0" />
          Credential saved and validated
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`model-${provider.id}`}>Model</Label>
          {isLoadingModels || liveModels.isFetching ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-panel px-3 text-meta text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading models…
            </div>
          ) : models.length === 0 ? (
            <div className="flex items-center gap-2 text-meta text-text-warning">
              <span>No models loaded.</span>
              <Button variant="ghost" size="sm" onClick={() => void loadModels()}>
                Refresh
              </Button>
            </div>
          ) : (
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
          )}
        </div>

        <div className="space-y-2">
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
            state={upsert.isError ? "invalid" : undefined}
          />
          {upsert.isError && (
            <p className="text-meta-sm text-text-danger">
              {upsert.error instanceof Error ? upsert.error.message : "Failed to save credential"}
            </p>
          )}
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-meta-sm ${
              testResult.success
                ? "border-success bg-success/5 text-text-success"
                : "border-danger bg-danger/5 text-text-danger"
            }`}
          >
            {testResult.success ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {saved && !hasEdits && (
          <p className="text-meta-sm text-text-secondary">
            {liveModels.data ? "Models loaded." : "Models refresh after validation."}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {hasEdits && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection()}
              disabled={!keyDraft.trim() || !selectedModel || testConn.isPending}
            >
              {testConn.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing
                </>
              ) : (
                "Test connection"
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void saveProvider()}
            disabled={(!hasEdits && !saved) || !selectedModel || upsert.isPending}
          >
            {upsert.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {saved ? (hasEdits ? "Update" : "Update key") : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>
    </Surface>
  );
}

export function AiProvidersSection() {
  const { data: catalog, isLoading: catalogLoading, isError: catalogError } = useAiProviderCatalog();
  const { data: credsData, isLoading: credsLoading } = useAiCredentials();

  const credByProvider = useMemo<CredentialByProvider>(() => {
    const map: CredentialByProvider = {};
    for (const credential of credsData?.credentials ?? []) {
      map[credential.provider] = credential;
    }
    return map;
  }, [credsData]);

  const [configured, available] = useMemo(() => {
    const conf: AiProviderCatalogItem[] = [];
    const avail: AiProviderCatalogItem[] = [];
    for (const provider of catalog ?? []) {
      if (credByProvider[provider.id]) {
        conf.push(provider);
      } else {
        avail.push(provider);
      }
    }
    return [conf, avail];
  }, [catalog, credByProvider]);

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

  if (catalogError) {
    return (
      <Surface variant="panel" padding="lg">
        <p className="text-meta text-text-danger">
          Failed to load provider catalog. Check your connection and try again.
        </p>
      </Surface>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <Surface variant="panel" padding="lg">
        <p className="text-meta text-text-secondary">No AI providers available.</p>
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

      <div className="space-y-6">
        {configured.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-body font-semibold text-text-primary">Configured providers</h4>
            <div className="space-y-4">
              {configured.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  saved={credByProvider[provider.id]}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {configured.length > 0 && (
            <h4 className="text-body font-semibold text-text-primary">Available providers</h4>
          )}
          {available.length > 0 ? (
            <div className="space-y-4">
              {available.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  saved={credByProvider[provider.id]}
                />
              ))}
            </div>
          ) : configured.length > 0 ? null : (
            <Surface variant="muted" padding="lg" className="text-center">
              <Bot className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-3 text-body font-medium text-text-primary">No providers configured</p>
              <p className="mt-1 text-meta text-text-secondary">
                Add an API key to connect an AI provider and start generating documentation.
              </p>
            </Surface>
          )}
        </div>
      </div>

      {!credsData?.has_active && (credsData?.credentials.length ?? 0) > 0 && (
        <Badge variant="warning">
          Select an active provider before running AI-powered actions.
        </Badge>
      )}
    </div>
  );
}
