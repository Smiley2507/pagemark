import { useMemo, useState } from "react";
import { Bot, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAiProviderCatalog,
  useAiCredentials,
  useUpsertAiCredential,
  useActivateAiCredential,
  useDeleteAiCredential,
} from "@/hooks/useAiCredentials";
import { cn } from "@/lib/utils";

export function AiProvidersSection() {
  const { data: catalog, isLoading: catalogLoading } = useAiProviderCatalog();
  const { data: credsData, isLoading: credsLoading } = useAiCredentials();
  const upsert = useUpsertAiCredential();
  const activate = useActivateAiCredential();
  const remove = useDeleteAiCredential();

  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [draftModels, setDraftModels] = useState<Record<string, string>>({});

  const credByProvider = useMemo(() => {
    const map: Record<string, any> = {};
    if (credsData?.credentials) {
      for (const c of credsData.credentials) {
        map[c.provider] = c;
      }
    }
    return map;
  }, [credsData]);

  if (catalogLoading || credsLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-meta text-muted-foreground">
            Loading AI providers…
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="text-section font-semibold">AI providers</h3>
          <p className="mt-1 text-meta text-muted-foreground">
            Bring your own API key (BYOK). Keys are encrypted at rest and never
            shown again after save. One active provider is used for outline
            generation and editor AI.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {(catalog ?? []).map((provider) => {
          const saved = credByProvider[provider.id];
          const modelId =
            draftModels[provider.id] ??
            saved?.model_id ??
            provider.models[0]?.id ??
            "";
          const keyDraft = draftKeys[provider.id] ?? "";

          return (
            <div
              key={provider.id}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                saved?.is_active
                  ? "border-primary/30 bg-muted/40"
                  : "border-border bg-card hover:bg-muted/10",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-semibold">{provider.label}</h4>
                  {saved ? (
                    <p className="text-meta-sm text-muted-foreground">
                      Saved · ends in {saved.key_hint}
                      {saved.is_active && (
                        <span className="ml-2 text-primary">Active</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-meta-sm text-muted-foreground">
                      Not connected
                    </p>
                  )}
                </div>
                {saved && (
                  <div className="flex items-center gap-2">
                    {!saved.is_active && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => activate.mutate(saved.id)}
                        disabled={activate.isPending}
                        className="bg-accent hover:bg-accent/80 text-foreground"
                      >
                        Set active
                      </Button>
                    )}
                    {saved.is_active && (
                      <span className="flex items-center gap-1 text-meta-sm font-medium text-emerald-600 dark:text-emerald-400 mr-2">
                        <Check className="h-4 w-4" />
                        Active
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          window.confirm(`Remove ${provider.label} API key?`)
                        ) {
                          remove.mutate(saved.id);
                        }
                      }}
                      disabled={remove.isPending}
                      aria-label="Remove key"
                      className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`model-${provider.id}`}>Model</Label>
                  <select
                    id={`model-${provider.id}`}
                    value={modelId}
                    onChange={(e) =>
                      setDraftModels((m) => ({
                        ...m,
                        [provider.id]: e.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`key-${provider.id}`}>
                    {saved ? "Replace API key" : "API key"}
                  </Label>
                  <Input
                    id={`key-${provider.id}`}
                    type="password"
                    placeholder={
                      saved ? "Enter new key to replace" : "Paste API key"
                    }
                    value={keyDraft}
                    onChange={(e) =>
                      setDraftKeys((k) => ({
                        ...k,
                        [provider.id]: e.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() =>
                    upsert.mutate({
                      provider: provider.id,
                      api_key: keyDraft,
                      model_id: modelId,
                    })
                  }
                  disabled={!keyDraft.trim() || upsert.isPending}
                >
                  {upsert.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating…
                    </>
                  ) : (
                    "Save & validate"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!credsData?.has_active && (credsData?.credentials.length ?? 0) > 0 && (
        <p className="mt-4 text-meta text-amber-700 dark:text-amber-300">
          Select an active provider so analysis can generate your documentation
          outline.
        </p>
      )}
    </section>
  );
}
