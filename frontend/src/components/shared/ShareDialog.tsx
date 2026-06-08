import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { documentsApi } from '@/api/documents';
import { useAuthStore } from '@/store/authStore';
import { orgApi } from '@/api/org';
import { useOrgStore } from '@/store/orgStore';
import type { DocumentShare } from '@/types';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  documentId: number;
  documentTitle: string;
}

const PERMISSION_OPTIONS = [
  { value: 'view', label: 'View' },
  { value: 'comment', label: 'Comment' },
  { value: 'edit', label: 'Edit' },
];

export function ShareDialog({ open, onOpenChange, projectId, documentId, documentTitle }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const activeOrgId = useOrgStore((state) => state.activeOrgId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permission, setPermission] = useState<'view' | 'comment' | 'edit'>('view');

  const { data: sharesData, isLoading: sharesLoading } = useQuery({
    queryKey: ['document-shares', projectId, documentId],
    queryFn: () => documentsApi.listShares(projectId, documentId),
    enabled: open && projectId > 0 && documentId > 0,
  });

  const { data: members } = useQuery({
    queryKey: ['org-members', activeOrgId],
    queryFn: () => orgApi.listMembers(activeOrgId!),
    enabled: open && !!activeOrgId,
  });

  const existingShareUserIds = new Set(
    (sharesData?.shares || []).map((share) => share.user_id)
  );

  const availableMembers = (members || [])
    .filter((member) => member.status === 'ACTIVE' && member.user_id !== currentUser?.id && !existingShareUserIds.has(member.user_id))
    .filter((member) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (member.user_name || '').toLowerCase().includes(q)
        || (member.user_email || '').toLowerCase().includes(q);
    });

  const addShare = useMutation({
    mutationFn: () => {
      if (!selectedUserId) throw new Error('No user selected');
      return documentsApi.addShare(projectId, documentId, selectedUserId, permission);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-shares', projectId, documentId] });
      setSelectedUserId(null);
      setSearchQuery('');
      toast.success('Document shared');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to share'),
  });

  const revokeShare = useMutation({
    mutationFn: (shareId: number) => documentsApi.revokeShare(projectId, documentId, shareId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-shares', projectId, documentId] });
      toast.success('Access revoked');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to revoke'),
  });

  const currentShares = sharesData?.shares || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Share "{documentTitle}" with organization members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3 rounded-md bg-panel-muted/55 p-4">
            <Label htmlFor="share-search">Add member</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  id="share-search"
                  placeholder="Search members by name or email..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'comment' | 'edit')}
                className="w-28"
              >
                {PERMISSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <Button
                type="button"
                onClick={() => addShare.mutate()}
                disabled={!selectedUserId || addShare.isPending}
              >
                {addShare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
              </Button>
            </div>
            {searchQuery && availableMembers.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded border border-separator bg-panel">
                {availableMembers.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-interaction-muted ${
                      selectedUserId === member.user_id ? 'bg-interaction-muted' : ''
                    }`}
                    onClick={() => {
                      setSelectedUserId(member.user_id);
                      setSearchQuery(member.user_name || member.user_email || '');
                    }}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-interaction/20 text-xs font-medium text-interaction-hover">
                      {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">
                        {member.user_name || 'Unknown'}
                      </p>
                      <p className="truncate text-meta text-text-muted">
                        {member.user_email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && availableMembers.length === 0 && (
              <p className="text-meta text-text-muted">No matching members found.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Shared with</Label>
            {sharesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            ) : currentShares.length === 0 ? (
              <EmptyState
                title="Not shared yet"
                description="Search for members above to share this document."
              />
            ) : (
              <div className="space-y-1">
                {currentShares.map((share) => (
                  <ShareRow
                    key={share.id}
                    share={share}
                    onRevoke={() => revokeShare.mutate(share.id)}
                    revoking={revokeShare.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({ share, onRevoke, revoking }: { share: DocumentShare; onRevoke: () => void; revoking: boolean }) {
  const permissionLabel = PERMISSION_OPTIONS.find((opt) => opt.value === share.permission)?.label || share.permission;

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-panel-muted/55">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-interaction/20 text-sm font-medium text-interaction-hover">
        {(share.user_name || share.user_email || '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {share.user_name || 'Unknown'}
        </p>
        <p className="truncate text-meta text-text-muted">
          {share.user_email}
        </p>
      </div>
      <span className="rounded bg-panel-muted/60 px-2 py-0.5 text-xs font-medium text-text-secondary">
        {permissionLabel}
      </span>
      <Button type="button" variant="ghost" size="icon" onClick={onRevoke} disabled={revoking} aria-label="Revoke access">
        {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
