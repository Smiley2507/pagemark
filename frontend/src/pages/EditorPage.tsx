import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Download,
  Share2,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { MiddlePanel } from "@/components/editor/MiddlePanel";
import { RightPanel } from "@/components/editor/RightPanel";
import {
  useAutosave,
  useDocument,
  useUpdateSection,
} from "@/hooks/useSections";
import { useProject } from "@/hooks/useProject";
import { cn } from "@/lib/utils";
import type { Section } from "@/types";

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  // --- Orchestration State ---
  const [mode, setMode] = useState<'write' | 'preview' | 'diff'>('write');
  const [diffData, setDiffData] = useState<{ original: string, refined: string } | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const middlePanelRef = useRef<{ scrollToSection: (id: number) => void }>(null);
  const leftPanelRef = useRef<any>(null);
  const rightPanelRef = useRef<any>(null);

  // --- Data Fetching ---
  const { data: project } = useProject(projectId);
  const { data: document } = useDocument(projectId);
  const { mutate: autosave } = useAutosave();
  const updateSection = useUpdateSection(projectId);

  const sections = document?.sections ?? [];
  const completionPercent = project?.completion_pct ?? 0;

  const activeSection = useMemo(() =>
    sections.find(s => s.id === activeSectionId) || null
  , [sections, activeSectionId]);

  // --- Actions ---
  const debouncedAutosave = (sectionId: number, content: string) => {
    autosave({ sectionId, content }, {
      onMutate: () => setIsSaving(true),
      onSettled: () => {
        setIsSaving(false);
        setLastSaved(new Date());
      }
    });
  };

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
          debouncedAutosave(activeSectionId, activeSection.content_md);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setMode(prev => prev === 'preview' ? 'write' : 'preview');
      }
      if (e.key === 'Escape' && mode === 'diff') {
        setMode('write');
        setDiffData(null);
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
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
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
                middlePanelRef.current?.scrollToSection(sectionId);
              }}
              completionPercent={completionPercent}
              isOpen={leftOpen}
              onToggle={() => setLeftOpen(o => !o)}
            />
          </div>

          <div className="w-px bg-border-1 hover:bg-accent transition-colors cursor-col-resize" />

          <div className="flex-1 min-w-0 overflow-hidden">
            <MiddlePanel
              ref={middlePanelRef}
              sections={sections}
              activeSectionId={activeSectionId}
              onSectionVisible={setActiveSectionId}
              mode={mode}
              onModeChange={(m) => {
                setMode(m);
                if (m !== 'diff') setDiffData(null);
              }}
              diffData={diffData}
              onSectionChange={(sectionId, content) => {
                debouncedAutosave(sectionId, content);
              }}
              onDiffAccept={(sectionId, content) => {
                acceptRefinement(sectionId, content);
                setMode('write');
                setDiffData(null);
              }}
              onDiffReject={() => {
                setMode('write');
                setDiffData(null);
              }}
              isSaving={isSaving}
              lastSaved={lastSaved}
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
              activeSectionHeading={activeSection?.heading}
              activeSectionContent={activeSection?.content_md}
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
    </div>
  );
};
