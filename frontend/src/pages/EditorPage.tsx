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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { MiddlePanel } from "@/components/editor/MiddlePanel";
import { RightPanel } from "@/components/editor/RightPanel";
import { ExportModal } from "@/components/editor/ExportModal";
import { QualityModal } from "@/components/editor/QualityModal";
import {
  useAutosave,
  useDocument,
  useUpdateSection,
} from "@/hooks/useSections";
import { useGenerateSection } from "@/hooks/useAI";
import { useProject } from "@/hooks/useProject";
import { cn } from "@/lib/utils";
import type { Section } from "@/types";

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  // --- Orchestration State ---
  const [mode, setMode] = useState<'write' | 'preview' | 'diff'>('write');
  const [diffData, setDiffData] = useState<{ original: string, refined: string } | undefined>(undefined);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  const middlePanelRef = useRef<{ scrollToSection: (id: number) => void }>(null);
  const leftPanelRef = useRef<any>(null);
  const rightPanelRef = useRef<any>(null);

  // --- Data Fetching ---
  const { data: project } = useProject(projectId);
  const { data: document } = useDocument(projectId);
  const updateSection = useUpdateSection(projectId);
  const generateSection = useGenerateSection(projectId);

  const sections = document?.sections ?? [];
  const completionPercent = project?.completion_pct ?? 0;

  const needsInputSection = useMemo(() =>
    sections.find(s => s.status === 'NEEDS_INPUT'),
    [sections]
  );

  const activeSection = useMemo(() =>
    sections.find(s => s.id === activeSectionId) || null
  , [sections, activeSectionId]);

  // --- Actions ---
  const acceptRefinement = (sectionId: number, content: string) => {
    updateSection.mutate({
      id: sectionId,
      data: { content_md: content }
    });
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeSectionId && activeSection) {
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
      if (e.key === 'Escape' && mode === 'diff') {
        setMode('write');
        setDiffData(undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSectionId, activeSection, mode]);

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
          <div className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-mono">
            {completionPercent}% complete
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          
          {activeSection?.status === 'pending' && (
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
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
          <div className="w-7 h-7 rounded-full bg-muted border border-border overflow-hidden ml-2">
            {/* User Avatar Placeholder */}
            <div className="w-full h-full flex items-center justify-center text-xs font-mono">
              U
            </div>
          </div>
        </div>
      </header>

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
              leftOpen ? "w-[220px]" : "w-0"
            )}
          >
            <LeftPanel
              sections={sections}
              activeSectionId={activeSectionId}
              onHeadingClick={(sectionId) => {
                setActiveSectionId(sectionId);
                // middlePanelRef.current?.scrollToSection(sectionId); // disabled until MiddlePanel supports it
              }}
              completionPercent={completionPercent}
              isOpen={leftOpen}
              onToggle={() => setLeftOpen(o => !o)}
            />
          </div>

          <div className="w-px bg-border-1 hover:bg-accent transition-colors cursor-col-resize" />

          <div className="flex-1 min-w-0 bg-background overflow-hidden relative">
            <MiddlePanel
              sections={sections}
              activeSectionId={activeSectionId}
              onSectionVisible={(id) => {
                if (mode !== 'diff') setActiveSectionId(id);
              }}
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
            />
          </div>

          <div className="w-px bg-border-1 hover:bg-accent transition-colors cursor-col-resize" />

          <div
            className={cn(
              "h-full transition-all duration-200 ease-in-out overflow-hidden",
              rightOpen ? "w-[300px]" : "w-0"
            )}
          >
            <RightPanel
              projectId={projectId}
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
            />
          </div>
        </div>
      </div>

      {/* Export modal */}
      <ExportModal
        projectId={projectId}
        projectName={project?.name ?? 'Documentation'}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      {/* Quality modal */}
      <QualityModal
        projectId={projectId}
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
      />
    </div>
  );
};
