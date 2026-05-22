import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import type { Section } from "@/types";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import type { MarkdownEditorHandle } from "@/components/editor/MarkdownEditor";
import { cn } from "@/lib/utils";

interface SectionEditorProps {
  section: Section;
  content: string;
  onChange: (value: string) => void;
  mode: "view" | "edit" | "refine";
}

export function SectionEditor({
  section,
  content,
  onChange,
  mode,
}: SectionEditorProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);

  // Auto-focus the editor when switching into edit mode
  useEffect(() => {
    if (mode === "edit") {
      // Defer one frame so the DOM has settled after any layout animation
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
        {/* Section heading — sits above the editor, not inside it */}
        <div className="shrink-0 border-b border-border px-12 py-4">
          <h2 className="text-title font-semibold text-foreground">
            {section.heading}
          </h2>
        </div>

        {/* Editor fills remaining height; padding comes from this wrapper so
            the CodeMirror surface itself stays padding-free as the theme requires */}
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
  // The diff viewer is rendered by the parent (EditorPage) when refineDraft is
  // set.  This fallback is shown while the AI is still generating.
  return (
    <div className="mx-auto max-w-3xl px-12 py-8">
      <h2 className="text-title font-semibold text-foreground">
        {section.heading}
      </h2>
      <p className="mt-4 text-meta text-muted-foreground">
        Use the AI assistant panel to generate a suggestion, then review it in
        the diff view.
      </p>
    </div>
  );
}
