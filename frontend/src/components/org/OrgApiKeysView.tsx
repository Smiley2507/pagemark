import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keysApi } from '@/api/keys';
import type { APIKey } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Key, Trash2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/dashboard/DashboardViews';

export const OrgApiKeysView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const {
    data: keys,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => keysApi.listAPIKeys(),
  });

  const createKeyMutation = useMutation({
    mutationFn: () => keysApi.createAPIKey(newKeyName),
    onSuccess: (data) => {
      toast.success('API Key created successfully');
      setGeneratedKey(data.raw_key ?? null);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create API key'),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: number) => keysApi.revokeAPIKey(keyId),
    onSuccess: () => {
      toast.success('API Key revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to revoke API key'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="h-10 w-64 bg-muted animate-pulse rounded" />
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  );
  if (isError) return <div className="p-6 text-destructive">Error loading API keys.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section font-semibold">API Keys</h2>
          <p className="text-meta text-muted-foreground">Generate and manage keys for programmatic access to the Pagemark API</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Key className="h-4 w-4" />
              Generate New Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{generatedKey ? 'Your API Key' : 'Create API Key'}</DialogTitle>
            </DialogHeader>
            {!generatedKey ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createKeyMutation.mutate();
                }}
                className="space-y-4 pt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. Production CI/CD"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createKeyMutation.isPending}>
                    {createKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Copy your API key now. For security reasons, this key will <strong>not be shown again</strong>.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedKey}
                      className="font-mono"
                    />
                    <Button
                      size="icon"
                      onClick={() => {
                        copyToClipboard(generatedKey);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setGeneratedKey(null);
                    setIsCreateOpen(false);
                  }}
                >
                  I've copied the key
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys && keys.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr className="divide-x divide-border">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyToClipboard(key.raw_key || '')}
                        title="Copy Key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Revoke API key "${key.name}"?`)) {
                            revokeKeyMutation.mutate(key.id);
                          }
                        }}
                        title="Revoke Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table >
        </div>
      ) : (
        <EmptyState
          title="No API keys found"
          description="You haven't generated any API keys for this organization yet."
          actionLabel="Generate New Key"
          onAction={() => setIsCreateOpen(true)}
          icon={Key}
        />
      )}
    </div>
  );
};
