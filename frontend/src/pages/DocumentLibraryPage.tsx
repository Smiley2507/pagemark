import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Grid3x3, List, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';

// Mock Document type until backend ready
interface DocumentItem {
  id: number;
  project_id: number;
  title: string;
  template_name?: string;
  status: 'draft' | 'in-progress' | 'complete' | 'stale';
  progress: number;
  last_updated: string;
  tags: string[];
}

export function DocumentLibraryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'progress'>('updated');
  
  const viewMode = useViewPreferenceStore((s) => s.getViewMode('project-documents', projectId));
  const setViewMode = useViewPreferenceStore((s) => s.setViewMode);
  
  // Mock data - replace with real API call
  const documents: DocumentItem[] = [
    {
      id: 1,
      project_id: Number(projectId),
      title: 'API Reference',
      template_name: 'API Documentation',
      status: 'in-progress',
      progress: 65,
      last_updated: '2026-06-05T10:30:00Z',
      tags: ['api', 'reference'],
    },
    {
      id: 2,
      project_id: Number(projectId),
      title: 'User Guide',
      template_name: 'Tutorial',
      status: 'draft',
      progress: 20,
      last_updated: '2026-06-04T14:20:00Z',
      tags: ['tutorial'],
    },
  ];
  
  const filteredDocuments = documents
    .filter((doc) => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'progress') return b.progress - a.progress;
      return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
    });
  
  const handleCreateDocument = () => {
    // Navigate to document setup with projectId
    navigate(`/document-setup?projectId=${projectId}`);
  };
  
  const handleDocumentClick = (documentId: number) => {
    navigate(`/projects/${projectId}/documents/${documentId}`);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section font-semibold text-text-primary">Documents</h2>
          <p className="text-body text-text-secondary mt-1">
            Manage documentation for this project
          </p>
        </div>
        <Button onClick={handleCreateDocument} className="gap-2">
          <Plus className="h-4 w-4" />
          New Document
        </Button>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 px-3 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="updated">Last Updated</option>
            <option value="name">Name</option>
            <option value="progress">Progress</option>
          </select>
          
          <div className="flex rounded-md border border-separator bg-panel">
            <button
              onClick={() => setViewMode('project-documents', 'list', projectId)}
              className={cn(
                'p-2 rounded-l-md transition-colors',
                viewMode === 'list' ? 'bg-interaction-muted text-interaction' : 'text-text-muted hover:text-text-primary'
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('project-documents', 'grid', projectId)}
              className={cn(
                'p-2 rounded-r-md transition-colors',
                viewMode === 'grid' ? 'bg-interaction-muted text-interaction' : 'text-text-muted hover:text-text-primary'
              )}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Document List/Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-panel rounded-lg border border-separator">
          <FileText className="h-12 w-12 text-text-muted mx-auto mb-4" />
          <p className="text-body text-text-secondary">
            {searchQuery ? 'No documents found matching your search.' : 'No documents yet. Create your first document to get started.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredDocuments.map((doc) => (
            <DocumentListItem key={doc.id} document={doc} onClick={() => handleDocumentClick(doc.id)} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onClick={() => handleDocumentClick(doc.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DocumentItemProps {
  document: DocumentItem;
  onClick: () => void;
}

function DocumentCard({ document, onClick }: DocumentItemProps) {
  const statusConfig = {
    draft: { variant: 'warning' as const, label: 'Draft' },
    'in-progress': { variant: 'info' as const, label: 'In Progress' },
    complete: { variant: 'success' as const, label: 'Complete' },
    stale: { variant: 'warning' as const, label: 'Stale' },
  };
  
  const config = statusConfig[document.status];
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-separator bg-panel p-4 transition-all hover:border-interaction hover:shadow-sm"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-body-lg font-semibold text-text-primary line-clamp-2">
            {document.title}
          </h3>
          <Badge variant={config.variant} showIcon={false}>
            {config.label}
          </Badge>
        </div>
        
        {document.template_name && (
          <div className="text-meta text-text-muted">{document.template_name}</div>
        )}
        
        {document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {document.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-panel-muted text-meta text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-meta text-text-muted">
            <span>Progress</span>
            <span>{document.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-panel-muted overflow-hidden">
            <div
              className="h-full bg-interaction transition-all"
              style={{ width: `${document.progress}%` }}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-meta text-text-muted">
          <Clock className="h-3 w-3" />
          <span>{new Date(document.last_updated).toLocaleDateString()}</span>
        </div>
      </div>
    </button>
  );
}

function DocumentListItem({ document, onClick }: DocumentItemProps) {
  const statusConfig = {
    draft: { variant: 'warning' as const, label: 'Draft', icon: AlertCircle },
    'in-progress': { variant: 'info' as const, label: 'In Progress', icon: Clock },
    complete: { variant: 'success' as const, label: 'Complete', icon: CheckCircle },
    stale: { variant: 'warning' as const, label: 'Stale', icon: AlertCircle },
  };
  
  const config = statusConfig[document.status];
  const Icon = config.icon;
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-separator bg-panel p-4 transition-all hover:border-interaction"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold text-text-primary truncate">{document.title}</h3>
            {document.template_name && (
              <p className="text-meta text-text-muted truncate mt-0.5">{document.template_name}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          {document.tags.length > 0 && (
            <div className="flex gap-1">
              {document.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-panel-muted text-meta text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-text-muted" />
            <Badge variant={config.variant} showIcon={false}>
              {config.label}
            </Badge>
          </div>
          
          <div className="w-20 text-right">
            <div className="text-meta text-text-primary font-medium">{document.progress}%</div>
          </div>
          
          <div className="w-24 text-right text-meta text-text-muted">
            {new Date(document.last_updated).toLocaleDateString()}
          </div>
        </div>
      </div>
    </button>
  );
}
