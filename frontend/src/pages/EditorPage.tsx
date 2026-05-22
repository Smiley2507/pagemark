import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  PanelLeft,
  PanelRight,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { RightPanel } from "@/components/editor/RightPanel";
import { SectionEditor } from "@/components/editor/SectionEditor";
import { DiffViewer } from "@/components/editor/DiffViewer";
import { useProject } from "@/hooks/useProject";
import {
  useAutosave,
  useDocument,
  useSection,
  useUpdateSection,
  useUpdateSectionStatus,
} from "@/hooks/useSections";
import { useEditorStore } from "@/store/editorStore";
import { flattenSections } from "@/lib/sections";
import type { Section } from "@/types";
import { cn } from "@/lib/utils";

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  const {
    activeSectionId,
    leftPanelOpen,
    rightPanelOpen,
    editorMode,
    setActiveSection,
    toggleLeftPanel,
    toggleRightPanel,
    setEditorMode,
  } = useEditorStore();

  const { data: project, refetch: refetchProject } = useProject(projectId);
  const { data: documentTree, isLoading: docLoading } = useDocument(projectId);
  const { data: activeSection } = useSection(activeSectionId);

  const [content, setContent] = useState("");
  const [refineDraft, setRefineDraft] = useState<string | null>(null);

  const { isSaving, lastSaved, markPersisted } = useAutosave(
    activeSectionId,
    content,
  );
  const updateSection = useUpdateSection(projectId);
  const updateStatus = useUpdateSectionStatus(projectId);

  const sections = documentTree?.sections ?? [];

  const flatSections = useMemo(() => flattenSections(sections), [sections]);

  const displaySection: Section | null = useMemo(() => {
    if (!activeSectionId) return null;
    return (
      activeSection ??
      flatSections.find((s) => s.id === activeSectionId) ??
      null
    );
  }, [activeSection, activeSectionId, flatSections]);

  useEffect(() => {
    if (!flatSections.length) return;
    if (activeSectionId && flatSections.some((s) => s.id === activeSectionId))
      return;
    setActiveSection(flatSections[0].id);
  }, [flatSections, activeSectionId, setActiveSection]);

  useEffect(() => {
    if (activeSection?.content_md !== undefined) {
      setContent(activeSection.content_md);
      markPersisted(activeSection.content_md, activeSection.updated_at);
    }
  }, [activeSection?.id, activeSection?.content_md]);

  useEffect(() => {
    setRefineDraft(null);
  }, [activeSectionId]);

  const completionPct = project?.completion_pct ?? 0;

  const autosaveLabel = useMemo(() => {
    if (isSaving) return "Saving…";
    if (lastSaved) {
      return `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`;
    }
    return "";
  }, [isSaving, lastSaved]);

  const handleStatusChange = (status: Section["status"]) => {
    if (!activeSectionId) return;
    updateStatus.mutate(
      { id: activeSectionId, status },
      { onSuccess: () => refetchProject() },
    );
  };

  const handleAcceptRefine = () => {
    if (refineDraft === null) return;
    setContent(refineDraft);
    setRefineDraft(null);
    setEditorMode("edit");
    if (activeSectionId) {
      updateSection.mutate({
        id: activeSectionId,
        data: { content_md: refineDraft },
      });
    }
  };

  if (docLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Page header */}
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-section font-semibold">
            {project?.name ?? "Editor"}
          </h1>
          <div className="mt-0.5 flex items-center gap-2">
            <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-meta-sm text-muted-foreground">
              {completionPct}% complete
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </header>

      {/* Three-panel grid */}
      <div
        className="grid min-h-0 flex-1"
        style={{
          // 220 px matches LeftPanel's internal motion.div width.
          // The grid column transitions with the panel to prevent layout gaps.
          gridTemplateColumns: `${leftPanelOpen ? "220px" : "0px"} 1fr ${rightPanelOpen ? "320px" : "0px"}`,
          transition: "grid-template-columns 0.2s ease-in-out",
        }}
      >
        {/* LeftPanel is always mounted so the fixed toggle button remains visible
            even when the panel is collapsed. */}
        <LeftPanel
          sections={sections}
          activeSectionId={activeSectionId}
          onHeadingClick={(sectionId) => setActiveSection(sectionId)}
          completionPercent={completionPct}
          isOpen={leftPanelOpen}
          onToggle={toggleLeftPanel}
        />

        <div className="flex min-w-0 flex-col border-x border-border">
          {/* Mode toolbar */}
          <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm">
            <div className="flex rounded-lg bg-muted p-1">
              {(["view", "edit", "refine"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEditorMode(mode)}
                  className={cn(
                    "rounded-md px-3 py-1 text-meta-sm font-medium capitalize",
                    editorMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {mode === "refine" ? (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Refine
                    </span>
                  ) : (
                    mode
                  )}
                </button>
              ))}
            </div>

            {displaySection && (
              <select
                value={displaySection.status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as Section["status"])
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-meta-sm"
                disabled={updateStatus.isPending}
              >
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="finalized">Finalized</option>
              </select>
            )}

            <span className="text-meta-sm text-muted-foreground">
              {autosaveLabel}
            </span>

            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLeftPanel}
                aria-label="Toggle left panel"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRightPanel}
                aria-label="Toggle right panel"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Middle panel content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!displaySection ? (
              <p className="p-8 text-center text-meta text-muted-foreground">
                Select a section from the contents panel.
              </p>
            ) : editorMode === "refine" && refineDraft !== null ? (
              <div className="h-full min-h-[400px]">
                <DiffViewer
                  original={content}
                  refined={refineDraft}
                  onAccept={handleAcceptRefine}
                  onReject={() => setRefineDraft(null)}
                />
              </div>
            ) : (
              <SectionEditor
                section={displaySection}
                content={content}
                onChange={setContent}
                mode={editorMode}
              />
            )}
          </div>
        </div>

        <motion.div
          className="overflow-hidden"
          initial={false}
          animate={{ opacity: rightPanelOpen ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {rightPanelOpen && (
            <RightPanel
              projectId={projectId}
              sectionId={activeSectionId}
              onContentRestored={(md) => {
                setContent(md);
                markPersisted(md);
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};
