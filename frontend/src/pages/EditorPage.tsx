import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Send,
  CheckCircle,
  XCircle,
  UserCheck,
} from "lucide-react";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { MiddlePanel, type MiddlePanelHandle } from "@/components/editor/MiddlePanel";
import { RightPanel } from "@/components/editor/RightPanel";

import { QualityModal } from "@/components/editor/QualityModal";
import {
  useDocument,
  useUpdateSection,
} from "@/hooks/useSections";
import { useGenerateSection } from "@/hooks/useAI";
import { useProject } from "@/hooks/useProject";
import { useOrgStore } from "@/store/orgStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { documentsApi } from "@/api/documents";
import { qualityApi } from "@/api/quality";
import { grammarApi } from "@/api/grammar";
import type { GrammarIssue } from "@/components/editor/grammarDecoration";
import { orgApi } from "@/api/org";
import { toast } from "sonner";
import type { Section, OrgMember } from "@/types";

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'write' | 'preview' | 'diff'>('write');
  const [diffData, setDiffData] = useState<{ original: string, refined: string } | undefined>(undefined);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  const [qualityOpen, setQualityOpen] = useState(false);
  const [grammarIssues, setGrammarIssues] = useState<Record<number, GrammarIssue[]>>({});
  const [grammarChecking, setGrammarChecking] = useState(false);

  const handleGrammarCheck = async () => {
    if (!activeSection || !activeSection.content_md.trim()) return;
    setGrammarChecking(true);
    try {
      const result = await grammarApi.checkGrammar(projectId, activeSection.content_md);
      const issues: GrammarIssue[] = result.matches.map(m => ({
        offset: m.offset,
        length: m.length,
        message: m.message,
        short_message: m.short_message,
        rule_id: m.rule_id,
        replacements: m.replacements.map(r => r.value),
      }));
      setGrammarIssues(prev => ({ ...prev, [activeSection.id]: issues }));
      if (issues.length === 0) {
        toast.success('No grammar issues found');
      } else {
        toast(`${issues.length} grammar issue${issues.length === 1 ? '' : 's'} found`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Grammar check failed');
    } finally {
      setGrammarChecking(false);
    }
  };

  const clearGrammarIssues = () => {
    if (activeSectionId) {
      setGrammarIssues(prev => {
        const next = { ...prev };
        delete next[activeSectionId];
        return next;
      });
    }
  };

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<number | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [qualityThreshold, setQualityThreshold] = useState(70);
  const [latestQualityScore, setLatestQualityScore] = useState<number | null>(null);

  const middlePanelRef = useRef<MiddlePanelHandle>(null);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const { activeOrgId } = useOrgStore();

  const { data: project } = useProject(projectId);
  const { data: document } = useDocument(projectId);
  const updateSection = useUpdateSection(projectId);
  const generateSection = useGenerateSection(projectId);

  const sections = useMemo(() => document?.sections ?? [], [document?.sections]);
  const [liveSections, setLiveSections] = useState<Section[]>([]);
  const completionPercent = project?.completion_pct ?? 0;

  useEffect(() => {
    setLiveSections(sections);
  }, [sections]);

  const editorSections = liveSections;

  const needsInputSection = useMemo(() =>
    editorSections.find(s => s.status === 'NEEDS_INPUT'),
    [editorSections]
  );

  const activeSection = useMemo(() =>
    editorSections.find(s => s.id === activeSectionId) || null
  , [editorSections, activeSectionId]);

  const docStatus = (document?.status || 'DRAFT') as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PENDING';

  // Fetch org members for reviewer dropdown
  useEffect(() => {
    if (activeOrgId) {
      orgApi.listMembers(activeOrgId).then(setMembers).catch(() => {});
    }
  }, [activeOrgId]);

  // Fetch org quality threshold and latest quality score
  useEffect(() => {
    if (activeOrgId) {
      orgApi.listOrganizations().then(orgs => {
        const org = orgs.find(o => o.id === activeOrgId);
        if (org) {
          setQualityThreshold((org as any).quality_threshold ?? 70);
        }
      }).catch(() => {});
    }
    if (projectId && document?.document_id) {
      qualityApi.getQuality(projectId, document.document_id).then(report => {
        setLatestQualityScore(report.overall_score);
      }).catch(() => {});
    }
  }, [activeOrgId, projectId]);

  const currentUser = useAuthStore(s => s.user);
  const isReviewer = currentUser != null && document?.reviewer_id === currentUser.id;
  const acceptRefinement = (sectionId: number, content: string) => {
    updateSection.mutate({
      id: sectionId,
      data: { content_md: content }
    });
  };

  const handleSubmitReview = async () => {
    if (!selectedReviewer) return;
    try {
      await documentsApi.submitForReview(projectId, selectedReviewer);
      toast.success('Document submitted for review');
      setReviewModalOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to submit for review');
    }
  };

  const handleApprove = async () => {
    try {
      await documentsApi.approveDocument(projectId);
      toast.success('Document approved');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRequestChanges = async () => {
    try {
      await documentsApi.requestChanges(projectId);
      toast.success('Changes requested, document reverted to DRAFT');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to request changes');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeSectionId && activeSection && docStatus !== 'APPROVED') {
          updateSection.mutate({
            id: activeSectionId,
            data: { content_md: activeSection.content_md }
          });
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setMode(prev => prev === 'preview' ? 'write' : 'preview');
      }
      if (e.key === 'Escape' && mode === 'diff') {
        setMode('write');
        setDiffData(undefined);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        const panel = leftPanelRef.current;
        if (panel?.isCollapsed()) {
          panel.expand();
          setLeftOpen(true);
        } else {
          panel?.collapse();
          setLeftOpen(false);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        const panel = rightPanelRef.current;
        if (panel?.isCollapsed()) {
          panel.expand();
          setRightOpen(true);
        } else {
          panel?.collapse();
          setRightOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSectionId, activeSection, mode, docStatus]);

  const statusBadge = () => {
    if (docStatus === 'DRAFT') return { label: 'Draft', cls: 'bg-muted text-muted-foreground' };
    if (docStatus === 'IN_REVIEW') return { label: 'In Review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    if (docStatus === 'APPROVED') return { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    return { label: 'Draft', cls: 'bg-muted text-muted-foreground' };
  };

  const badge = statusBadge();

  // Find reviewers (Technical Writers and PMs)
  const potentialReviewers = members.filter(m =>
    m.role === 'TECHNICAL_WRITER' || m.role === 'PROJECT_MANAGER' || m.role === 'ADMIN'
  );

  // Quality threshold warning
  const showQualityWarning = latestQualityScore !== null && latestQualityScore < qualityThreshold;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <EditorTopBar
        projectId={projectId}
        projectName={project?.name ?? 'Project Editor'}
        completionPct={completionPercent}
        docStatus={docStatus}
        projectStatus={project?.status ?? 'draft'}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => {
          const panel = leftPanelRef.current;
          if (panel?.isCollapsed()) {
            panel.expand();
            setLeftOpen(true);
          } else {
            panel?.collapse();
            setLeftOpen(false);
          }
        }}
        onToggleRight={() => {
          const panel = rightPanelRef.current;
          if (panel?.isCollapsed()) {
            panel.expand();
            setRightOpen(true);
          } else {
            panel?.collapse();
            setRightOpen(false);
          }
        }}
        onGenerateAI={() => {
          if (activeSectionId) generateSection.mutate(activeSectionId);
        }}
        onQualityClick={() => setQualityOpen(true)}
        onGrammarCheck={handleGrammarCheck}
        isGenerating={generateSection.isPending}
        grammarChecking={grammarChecking}
        qualityScore={latestQualityScore}
        issueCount={sections.filter(s => s.status === 'NEEDS_INPUT').length}
        userName={currentUser?.name}
        overflowActions={[
          ...(docStatus === 'DRAFT'
            ? [{
                label: 'Submit for Review',
                icon: <Send className="h-3.5 w-3.5" />,
                onClick: () => setReviewModalOpen(true),
              }]
            : []),
          ...(docStatus === 'IN_REVIEW'
            ? [{
                label: 'Approve',
                icon: <CheckCircle className="h-3.5 w-3.5" />,
                onClick: handleApprove,
              },
              {
                label: 'Request Changes',
                icon: <XCircle className="h-3.5 w-3.5" />,
                onClick: handleRequestChanges,
              }]
            : []),
        ]}
      />

      {/* Reviewer banner */}
      {docStatus === 'IN_REVIEW' && isReviewer && (
        <div className="mx-auto w-full px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <UserCheck className="h-4 w-4" />
              <p className="text-sm font-medium">You are reviewing this document.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleRequestChanges}>
                <XCircle className="h-3 w-3 mr-1" />
                Request Changes
              </Button>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quality threshold warning */}
      {showQualityWarning && (
        <div className="mx-auto w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 max-w-5xl mx-auto text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">
              Warning: Document score ({Math.round(latestQualityScore!)}%) is below the Organization threshold ({qualityThreshold}%). Please refine content.
            </p>
          </div>
        </div>
      )}

      {/* Needs Input Banner */}
      {needsInputSection && (
        <div className="mx-auto max-w-full px-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium">
                The AI needs more information to complete the section <span className="font-bold">"{needsInputSection.heading}"</span>.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
              onClick={() => {
                setActiveSectionId(needsInputSection.id);
                setRightOpen(true);
              }}
            >
              Provide answer
            </Button>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        <Group orientation="horizontal" className="flex-1">
          <Panel
            panelRef={leftPanelRef}
            id="left-panel"
            defaultSize="240px"
            minSize="160px"
            maxSize="400px"
            collapsible
            collapsedSize="0px"
            onResize={(size) => setLeftOpen(size.inPixels > 0)}
          >
            <LeftPanel
              sections={editorSections}
              activeSectionId={activeSectionId}
              onHeadingClick={(sectionId) => {
                setActiveSectionId(sectionId);
                middlePanelRef.current?.scrollToSection(sectionId);
              }}
            />
          </Panel>

          <Separator className="w-px bg-border hover:bg-accent transition-colors cursor-col-resize data-[resize-handle-active]:bg-accent" />

          <Panel id="middle-panel" minSize="400px">
            <MiddlePanel
              ref={middlePanelRef}
              sections={editorSections}
              projectId={projectId}
              activeSectionId={activeSectionId}
              onSectionVisible={(id) => {
                if (mode !== 'diff') setActiveSectionId(id);
              }}
              onSectionsChange={setLiveSections}
              mode={mode}
              onModeChange={(m) => {
                setMode(m);
                if (m !== 'diff') setDiffData(undefined);
              }}
              diffData={diffData}
              onDiffAccept={() => {
                if (activeSectionId && diffData) {
                  acceptRefinement(activeSectionId, diffData.refined);
                }
                setMode('write');
                setDiffData(undefined);
              }}
              onDiffReject={() => {
                setMode('write');
                setDiffData(undefined);
              }}
              isApproved={docStatus === 'APPROVED'}
              grammarIssues={grammarIssues}
            />
          </Panel>

          <Separator className="w-px bg-border hover:bg-accent transition-colors cursor-col-resize data-[resize-handle-active]:bg-accent" />

          <Panel
            panelRef={rightPanelRef}
            id="right-panel"
            defaultSize="360px"
            minSize="240px"
            maxSize="600px"
            collapsible
            collapsedSize="0px"
            onResize={(size) => setRightOpen(size.inPixels > 0)}
          >
            <RightPanel
              projectId={projectId}
              documentId={document?.document_id ?? 0}
              sections={editorSections}
              activeSectionId={activeSectionId}
              activeSectionHeading={activeSection?.heading ?? null}
              activeSectionContent={activeSection?.content_md ?? ""}
              activeSectionStatus={activeSection?.status as any}
              onDiffReceived={(diff) => {
                setDiffData(diff);
                setMode('diff');
              }}
              onContentAccepted={(content) => {
                if (activeSectionId) {
                  updateSection.mutate({
                    id: activeSectionId,
                    data: { content_md: content }
                  });
                }
              }}
              isApproved={docStatus === 'APPROVED'}
            />
          </Panel>
        </Group>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReviewModalOpen(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Submit for Review</h3>
            <p className="text-sm text-muted-foreground mb-4">Select a reviewer (Technical Writer or Project Manager) to review this document.</p>
            <select
              value={selectedReviewer ?? ''}
              onChange={e => setSelectedReviewer(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:border-primary"
            >
              <option value="">Select a reviewer...</option>
              {potentialReviewers.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_name || m.user_email}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitReview} disabled={!selectedReviewer}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      {/* Quality modal */}
      <QualityModal
        projectId={projectId}
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
      />
    </div>
  );
};
