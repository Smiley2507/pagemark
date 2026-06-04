import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Download,
  Share2,
  PanelLeft,
  PanelRight,
  Sparkles,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Lock,
  Send,
  CheckCircle,
  XCircle,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { MiddlePanel, type MiddlePanelHandle } from "@/components/editor/MiddlePanel";
import { RightPanel } from "@/components/editor/RightPanel";

import { QualityModal } from "@/components/editor/QualityModal";
import {
  useAutosave,
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

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<number | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [qualityThreshold, setQualityThreshold] = useState(70);
  const [latestQualityScore, setLatestQualityScore] = useState<number | null>(null);

  const middlePanelRef = useRef<MiddlePanelHandle>(null);
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

  const docStatus = document?.status || 'DRAFT';

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
    if (projectId) {
      qualityApi.getQuality(projectId).then(report => {
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
        setLeftOpen(o => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        setRightOpen(o => !o);
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
      {/* Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {project?.name ?? "Project Editor"}
          </span>
          {/* Status badge */}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>
            {docStatus === 'APPROVED' && <Lock className="inline h-3 w-3 mr-1" />}
            {badge.label}
          </span>
          <div className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-mono">
            {completionPercent}% complete
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Submit for Review button (only for DRAFT) */}
          {docStatus === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setReviewModalOpen(true)}
            >
              <Send className="h-4 w-4" />
              <span>Submit for Review</span>
            </Button>
          )}

          {/* Approve/Request Changes (for reviewer) */}
          {docStatus === 'IN_REVIEW' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleRequestChanges}
              >
                <XCircle className="h-4 w-4" />
                <span>Request Changes</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
              >
                <CheckCircle className="h-4 w-4" />
                <span>Approve</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftOpen(o => !o)}
            aria-label="Toggle left panel"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightOpen(o => !o)}
            aria-label="Toggle right panel"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border-1 mx-1" />

          {activeSection?.status === 'pending' && docStatus !== 'APPROVED' && (
            <Button 
              variant="default" 
              size="sm" 
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                if (activeSectionId) {
                  generateSection.mutate(activeSectionId);
                }
              }}
              disabled={generateSection.isPending}
            >
              {generateSection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>{generateSection.isPending ? "Generating..." : "Generate AI"}</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setQualityOpen(true)}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Quality</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => navigate(`/export/${projectId}`)}
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Project link copied to clipboard');
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <div className="w-7 h-7 rounded-full bg-muted border border-border overflow-hidden ml-2">
            <div className="w-full h-full flex items-center justify-center text-xs font-mono">
              {(currentUser?.name || 'U')[0].toUpperCase()}
            </div>
          </div>
        </div>
      </header>

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
        <div className="flex flex-1 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-200 ease-in-out overflow-hidden",
              leftOpen ? "w-[240px]" : "w-0"
            )}
          >
            <LeftPanel
              sections={editorSections}
              activeSectionId={activeSectionId}
              onHeadingClick={(sectionId) => {
                setActiveSectionId(sectionId);
                middlePanelRef.current?.scrollToSection(sectionId);
              }}
              completionPercent={completionPercent}
              isOpen={leftOpen}
              onToggle={() => setLeftOpen(o => !o)}
            />
          </div>

          <div className="w-px bg-border-1 hover:bg-accent transition-colors cursor-col-resize" />

          <div className="flex-1 min-w-0 bg-background overflow-hidden relative">
            <MiddlePanel
              ref={middlePanelRef}
              sections={editorSections}
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
            />
          </div>

          <div className="w-px bg-border-1 hover:bg-accent transition-colors cursor-col-resize" />

          <div
            className={cn(
              "h-full transition-all duration-200 ease-in-out overflow-hidden",
              rightOpen ? "w-[320px]" : "w-0"
            )}
          >
            <RightPanel
              projectId={projectId}
              documentId={document?.document_id ?? 0}
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
              isOpen={rightOpen}
              onToggle={() => setRightOpen(o => !o)}
              isApproved={docStatus === 'APPROVED'}
            />
          </div>
        </div>
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
