import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Grid2X2, List, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { Surface } from '@/components/ui/surface';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { documentsApi } from '@/api/documents';
import {
  DocumentSummaryCard,
  DocumentSummaryRow,
  EmptyDocumentState,
  mapDocumentStatus,
  mapFreshness,
  type WorkspaceDocumentItem,
} from '@/components/workspace/document-library-items';
import { toast } from 'sonner';

type FilterMode = 'all' | 'active' | 'stale';

export function DocumentLibraryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'progress'>('updated');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editingDocument, setEditingDocument] = useState<WorkspaceDocumentItem | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<WorkspaceDocumentItem | null>(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');
  const [tags, setTags] = useState('');
  const viewMode = useViewPreferenceStore((state) => state.getViewMode('project-documents', projectId));
  const setViewMode = useViewPreferenceStore((state) => state.setViewMode);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.listDocuments(Number(projectId)),
    enabled: !!projectId,
  });

  const documents = useMemo<WorkspaceDocumentItem[]>(() => (
    (response?.documents || []).map((document) => {
      const status = mapDocumentStatus(document.status);
      const freshness = mapFreshness(document.freshness);
      return {
        id: document.id,
        title: document.title,
        templateName: document.template?.name,
        statusLabel: status.label,
        statusVariant: status.variant,
        freshnessLabel: freshness.label,
        freshnessVariant: freshness.variant,
        progress: document.progress.pct,
        lastActivityAt: document.last_activity_at,
        tags: document.tags,
        purpose: document.purpose,
        audience: document.audience,
        context: document.context,
      };
    })
  ), [response?.documents]);

  const updateDocument = useMutation({
    mutationFn: () => {
      if (!editingDocument) throw new Error('No Document selected');
      return documentsApi.updateDocument(pid, editingDocument.id, {
        title: title.trim() || editingDocument.title,
        purpose: purpose.trim() || undefined,
        audience: audience.trim() || undefined,
        context: context.trim() || undefined,
        tags: parseTags(tags),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      toast.success('Document updated');
      setEditingDocument(null);
    },
    onError: () => toast.error('Failed to update Document'),
  });

  const deleteDocument = useMutation({
    mutationFn: (documentId: number) => documentsApi.deleteDocument(pid, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete Document'),
  });

  const openEditDocument = (document: WorkspaceDocumentItem) => {
    setEditingDocument(document);
    setTitle(document.title);
    setPurpose(document.purpose || '');
    setAudience(document.audience || '');
    setContext(document.context || '');
    setTags(document.tags.join(', '));
  };

  const filteredDocuments = documents
    .filter((document) => {
      const matchesQuery = document.title.toLowerCase().includes(searchQuery.toLowerCase())
        || (document.templateName || '').toLowerCase().includes(searchQuery.toLowerCase())
        || document.tags.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesQuery) {
        return false;
      }
      if (filterMode === 'active') {
        return document.statusVariant === 'generation' || document.statusVariant === 'needsInput';
      }
      if (filterMode === 'stale') {
        return document.freshnessVariant === 'warning';
      }
      return true;
    })
    .sort((left, right) => {
      if (sortBy === 'name') {
        return left.title.localeCompare(right.title);
      }
      if (sortBy === 'progress') {
        return right.progress - left.progress;
      }
      return new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime();
    });

  if (isLoading) {
    return (
      <Surface variant="muted" padding="lg">
        <p className="text-body text-text-secondary">Loading Documents…</p>
      </Surface>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load Documents"
        description={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-section font-semibold text-text-primary">Documents</h2>
          </div>
          <Button type="button" onClick={() => navigate(`/document-setup?projectId=${projectId}`)}>
            New Document
          </Button>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              aria-label="Search Documents"
              className="pl-9"
              placeholder="Search Documents by title, Template, or tags"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <SegmentedControl
              label="Document filter"
              value={filterMode}
              onValueChange={(value) => setFilterMode(value as FilterMode)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'stale', label: 'Changed' },
              ]}
            />
            <Select
              aria-label="Sort Documents"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'updated' | 'name' | 'progress')}
            >
              <option value="updated">Last activity</option>
              <option value="name">Title</option>
              <option value="progress">Progress</option>
            </Select>
          </div>
        </div>
      </Surface>

      <div className="flex justify-end">
        <SegmentedControl
          label="Document library view"
          value={viewMode}
          onValueChange={(value) => setViewMode('project-documents', value as 'list' | 'grid', projectId)}
          options={[
            { value: 'list', label: <List className="h-4 w-4" /> },
            { value: 'grid', label: <Grid2X2 className="h-4 w-4" /> },
          ]}
        />
      </div>

      {documents.length === 0 ? (
        <EmptyDocumentState />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          title="No Documents found"
          description="Try a different search or filter."
        />
      ) : viewMode === 'list' ? (
        <Surface variant="panel" padding="none" className="divide-y divide-separator overflow-hidden">
          {filteredDocuments.map((document) => (
            <DocumentSummaryRow
              key={document.id}
              document={document}
              onOpen={() => navigate(`/projects/${projectId}/documents/${document.id}`)}
              onEdit={() => openEditDocument(document)}
              onDelete={() => setDeletingDocument(document)}
            />
          ))}
        </Surface>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filteredDocuments.map((document) => (
            <DocumentSummaryCard
              key={document.id}
              document={document}
              onOpen={() => navigate(`/projects/${projectId}/documents/${document.id}`)}
              onEdit={() => openEditDocument(document)}
              onDelete={() => setDeletingDocument(document)}
            />
          ))}
        </div>
      )}

      <Dialog open={editingDocument !== null} onOpenChange={(open) => { if (!open) setEditingDocument(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription className="sr-only">
              Rename the Document and edit its purpose, audience, context, or tags.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="document-title">Title</Label>
              <Input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-purpose">Purpose</Label>
              <Input id="document-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-audience">Audience</Label>
              <Input id="document-audience" value={audience} onChange={(event) => setAudience(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-context">Context</Label>
              <Input id="document-context" value={context} onChange={(event) => setContext(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-tags">Tags</Label>
              <Input id="document-tags" value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingDocument(null)}>Cancel</Button>
              <Button type="button" onClick={() => updateDocument.mutate()} disabled={updateDocument.isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingDocument !== null}
        onOpenChange={(open) => { if (!open) setDeletingDocument(null); }}
        title="Delete Document?"
        description={`Delete "${deletingDocument?.title || 'this Document'}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingDocument) deleteDocument.mutate(deletingDocument.id);
          setDeletingDocument(null);
        }}
      />
    </div>
  );
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
