import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
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

type FilterMode = 'all' | 'active' | 'stale';

export function DocumentLibraryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'progress'>('updated');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
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
      };
    })
  ), [response?.documents]);

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
            <p className="mt-1 text-body text-text-secondary">
              Documents are the primary Project surface. Review generation, freshness, purpose, Template, and recent activity here.
            </p>
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
                { value: 'stale', label: 'Source changes' },
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
            { value: 'list', label: 'List' },
            { value: 'grid', label: 'Grid' },
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
        <div className="space-y-3">
          {filteredDocuments.map((document) => (
            <DocumentSummaryRow
              key={document.id}
              document={document}
              onOpen={() => navigate(`/projects/${projectId}/documents/${document.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredDocuments.map((document) => (
            <DocumentSummaryCard
              key={document.id}
              document={document}
              onOpen={() => navigate(`/projects/${projectId}/documents/${document.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
