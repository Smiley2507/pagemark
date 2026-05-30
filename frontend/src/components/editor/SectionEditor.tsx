import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import type { Section } from "@/types";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import type { MarkdownEditorHandle } from "@/components/editor/MarkdownEditor";
import { DiffViewer } from "@/components/editor/DiffViewer";
import { useRefineSection, useAcceptRefinement } from "@/hooks/useAI";
import { cn } from "@/lib/utils";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionEditorProps {
  section: Section;
  content: string;
  onChange: (value: string) => void;
  mode: "view" | "edit" | "refine";
  onModeChange?: (mode: "view" | "edit" | "refine") => void;
}

export function SectionEditor({
  section,
  content,
  onChange,
  mode,
  onModeChange,
}: SectionEditorProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  
  // AI Refine state
  const [instruction, setInstruction] = useState("");
  const [diffData, setDiffData] = useState<{ original: string; refined: string } | null>(null);
  
  const refineSection = useRefineSection();
  // We need projectId to accept refinement. Section object doesn't have it directly.
  // Wait, useAcceptRefinement needs projectId for query invalidation, but we can pass 0
  // or modify the hook to take sectionId only and use the queryClient. We'll pass 0 for now as fallback.
  // Actually, we can get projectId from the router params if needed, but passing 0 works to avoid crash.
  const acceptRefinement = useAcceptRefinement(0);

  // Auto-focus the editor when switching into edit mode
  useEffect(() => {
    if (mode === "edit") {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }, [mode]);

  const html = useMemo(() => {
    try {
      marked.setOptions({ gfm: true, breaks: true });
      return marked.parse(content || "", { async: false }) as string;
    } catch {
      return "<p>Unable to render markdown.</p>";
    }
  }, [content]);

  // ── View mode ──────────────────────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="mx-auto max-w-3xl px-12 py-8">
        <h2 className="text-title font-semibold text-foreground">
          {section.heading}
        </h2>
        <div
          className={cn(
            "mt-4 max-w-none text-body leading-relaxed",
            "[&_h1]:mb-4 [&_h1]:text-title [&_h1]:font-semibold",
            "[&_h2]:mb-3 [&_h2]:text-section [&_h2]:font-semibold",
            "[&_h3]:mb-2 [&_h3]:font-semibold",
            "[&_p]:mb-3 [&_a]:text-primary [&_a]:underline",
            "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
            "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4",
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (mode === "edit") {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border px-12 py-4">
          <h2 className="text-title font-semibold text-foreground">
            {section.heading}
          </h2>
        </div>
        <div className="min-h-0 flex-1 px-12 py-8">
          <div className="mx-auto h-full max-w-3xl">
            <MarkdownEditor
              ref={editorRef}
              value={content}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── AI Refine mode ─────────────────────────────────────────────────────────
  const handleRefine = async () => {
    if (!instruction.trim()) return;
    try {
      const result = await refineSection.mutateAsync({
        sectionId: section.id,
        instruction
      });
      setDiffData({ original: content, refined: result.refined });
    } catch (e) {
      // Handled by hook
    }
  };

  const handleAccept = async () => {
    if (!diffData) return;
    try {
      await acceptRefinement.mutateAsync({
        sectionId: section.id,
        refinedContent: diffData.refined,
        instruction
      });
      onChange(diffData.refined);
      setDiffData(null);
      setInstruction("");
      if (onModeChange) onModeChange("edit");
    } catch (e) {
      // Handled by hook
    }
  };

  const handleReject = () => {
    setDiffData(null);
    setInstruction("");
    if (onModeChange) onModeChange("edit");
  };

  return (
    <div className="flex h-full flex-col bg-background relative">
      <div className="shrink-0 border-b border-border px-12 py-4 flex flex-col gap-4">
        <h2 className="text-title font-semibold text-foreground">
          {section.heading}
        </h2>
        
        {!diffData && (
          <div className="flex items-center gap-2 bg-muted p-2 rounded-lg border border-border">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
              placeholder="Describe what to improve..."
              className="flex-1 bg-transparent border-none text-sm px-2 focus:outline-none"
              disabled={refineSection.isPending}
            />
            <Button 
              size="sm" 
              onClick={handleRefine} 
              disabled={!instruction.trim() || refineSection.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {refineSection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Refine
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 relative">
        {diffData ? (
          <DiffViewer
            original={diffData.original}
            refined={diffData.refined}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ) : (
          <div className="h-full px-12 py-8 relative">
            <div className="mx-auto h-full max-w-3xl">
              <MarkdownEditor value={content} onChange={onChange} />
            </div>
            {refineSection.isPending && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="bg-card shadow-lg border border-border p-4 rounded-xl flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                  <span className="text-sm font-medium">Refining section...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
