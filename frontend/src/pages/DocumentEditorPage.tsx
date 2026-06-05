import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, AlertCircle, CheckCircle, Clock, Eye } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { useDocument } from '@/hooks/useSections';
import { documentsApi } from '@/api/documents';

export function DocumentEditorPage() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();
  const recordRecentWork = useViewPreferenceStore((s) => s.recordRecentWork);
  const getLastSection = useViewPreferenceStore((s) => s.getLastSection);
  
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [hasSourceChanges, setHasSourceChanges] = useState(false);
  
  const { data: document } = useDocument(Number(projectId));
  const sections = document?.sections || [];
  
  // Resume to last active section
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      const lastSectionId = getLastSection(Number(projectId), Number(documentId));
      const targetSection = lastSectionId 
        ? sections.find((s) => s.id === lastSectionId)
        : sections[0];
      
      if (targetSection) {
        setActiveSectionId(targetSection.id);
        setContent(targetSection.content_md);
      }
    }
  }, [sections, activeSectionId, projectId, documentId, getLastSection]);
  
  // Record recent work when section changes
  useEffect(() => {
    if (activeSectionId) {
      recordRecentWork({
        projectId: Number(projectId),
        documentId: Number(documentId),
        sectionId: activeSectionId,
      });
    }
  }, [activeSectionId, projectId, documentId, recordRecentWork]);
  
  // Mock source change detection
  useEffect(() => {
    // Simulate source change notification
    const timer = setTimeout(() => setHasSourceChanges(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  
  // Accept review mutation
  const acceptReviewMutation = useMutation({
    mutationFn: (sectionId: number) => documentsApi.acceptSectionReview(sectionId),
    onSuccess: () => {
      toast.success('Section marked as reviewed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activeSection = sections.find((s) => s.id === activeSectionId);
  
  const getSectionStatus = (section: typeof sections[0]) => {
    if (section.status === 'finalized') return { variant: 'success' as const, label: 'Reviewed', icon: CheckCircle };
    if (section.status === 'NEEDS_INPUT') return { variant: 'needsInput' as const, label: 'Needs Input', icon: AlertCircle };
    if (section.status === 'draft') return { variant: 'generation' as const, label: 'Draft', icon: Clock };
    return { variant: 'neutral' as const, label: 'Pending', icon: Clock };
  };
  
  return (
    <div className="h-screen flex flex-col bg-workspace">
      {/* Editor Top Bar */}
      <div className="border-b border-separator bg-panel px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-body-lg font-semibold text-text-primary">
              {document?.sections?.[0]?.heading || 'Untitled Document'}
            </h1>
            <div className="text-meta text-text-muted">
              {sections.length} sections
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </Button>
        </div>
      </div>
      
      {/* Source Change Notice */}
      {hasSourceChanges && (
        <div className="px-6 pt-4">
          <Notice variant="info" title="Source Changes Detected">
            The repository has been updated. Review changes to keep documentation fresh.
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => setHasSourceChanges(false)}>
                Review Changes
              </Button>
            </div>
          </Notice>
        </div>
      )}
      
      {/* Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Outline */}
        {outlineOpen && (
          <div className="w-64 border-r border-separator bg-panel overflow-y-auto">
            <div className="p-4 border-b border-separator flex items-center justify-between">
              <h2 className="text-body font-semibold text-text-primary">Outline</h2>
              <button
                onClick={() => setOutlineOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-2">
              {sections.map((section) => {
                const status = getSectionStatus(section);
                const Icon = status.icon;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSectionId(section.id);
                      setContent(section.content_md);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-md transition-colors mb-1',
                      activeSectionId === section.id
                        ? 'bg-interaction-muted text-text-primary'
                        : 'hover:bg-panel-muted text-text-secondary'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body truncate">{section.heading}</span>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Toggle Outline Button */}
        {!outlineOpen && (
          <button
            onClick={() => setOutlineOpen(true)}
            className="absolute left-4 top-20 z-10 p-2 rounded-md border border-separator bg-panel text-text-muted hover:text-text-primary shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        
        {/* Main Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {activeSection ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-title font-semibold text-text-primary">
                    {activeSection.heading}
                  </h2>
                  <Badge variant={getSectionStatus(activeSection).variant}>
                    {getSectionStatus(activeSection).label}
                  </Badge>
                </div>
                
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full min-h-[500px] p-4 rounded-md border border-input bg-canvas text-body text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  placeholder="Start writing..."
                />
                
                <div className="flex items-center gap-2">
                  <Button size="sm">Save</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acceptReviewMutation.mutate(activeSection.id)}
                    disabled={acceptReviewMutation.isPending}
                  >
                    {acceptReviewMutation.isPending ? 'Marking...' : 'Mark as Reviewed'}
                  </Button>
                  {activeSection.status === 'draft' && (
                    <Button size="sm" variant="outline" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-text-muted">
                Select a section to start editing
              </div>
            )}
          </div>
        </div>
        
        {/* AI Assistant Panel */}
        {aiPanelOpen && (
          <div className="w-80 border-l border-separator bg-panel overflow-y-auto">
            <div className="p-4 border-b border-separator flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-interaction" />
                <h2 className="text-body font-semibold text-text-primary">AI Assistant</h2>
              </div>
              <button
                onClick={() => setAiPanelOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="text-body text-text-secondary">
                Ask me to help with this section, suggest improvements, or generate new content.
              </div>
              
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Sparkles className="h-4 w-4" />
                  Improve clarity
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Sparkles className="h-4 w-4" />
                  Add examples
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <Sparkles className="h-4 w-4" />
                  Check grammar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
