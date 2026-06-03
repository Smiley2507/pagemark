import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@/types";

// ── Heading extraction ────────────────────────────────────────────────────────

export interface HeadingItem {
  level: 1 | 2;
  text: string;
  sectionId: number;
  headingIndex: number;
  isSectionTitle: boolean;
}

export interface SectionOutline {
  sectionId: number;
  sectionTitle: string;
  headings: HeadingItem[];
}

export function extractOutline(sections: Section[]): SectionOutline[] {
  return sections.map((section) => {
    const sectionTitle = section.title?.trim() ? section.title : section.heading;
    const headings: HeadingItem[] = [
      {
        level: 1,
        text: sectionTitle,
        sectionId: section.id,
        headingIndex: -1,
        isSectionTitle: true,
      },
    ];

    const RE = /^(#{1,2})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    let headingIndex = 0;

    while ((match = RE.exec(section.content_md)) !== null) {
      headings.push({
        level: match[1].length as 1 | 2,
        text: match[2].trim(),
        sectionId: section.id,
        headingIndex: headingIndex++,
        isSectionTitle: false,
      });
    }

    return {
      sectionId: section.id,
      sectionTitle,
      headings,
    };
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LeftPanelProps {
  sections: Section[];
  activeSectionId: number | null;
  onHeadingClick: (sectionId: number, headingText: string) => void;
  completionPercent: number;
  isOpen: boolean;
  onToggle: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeftPanel({
  sections,
  activeSectionId,
  onHeadingClick,
  completionPercent,
  isOpen,
  onToggle,
}: LeftPanelProps) {
  const outline = useMemo(() => extractOutline(sections), [sections]);

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 240 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative h-full shrink-0 overflow-hidden border-r border-border/50 bg-muted/20"
      >
        <div className="flex h-full w-[240px] flex-col">
          <div className="h-0.5 w-full shrink-0 bg-muted">
            <div
              className="h-full bg-foreground/30 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          <nav
            aria-label="Document outline"
            className="flex-1 space-y-2 overflow-y-auto px-2 py-4 scrollbar-hide"
          >
            {outline.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">
                Add headings to your content to see them here.
              </p>
            ) : (
              outline.map((section, sectionIndex) => {
                const isActive = section.sectionId === activeSectionId;

                return (
                  <div
                    key={section.sectionId}
                    className={cn(
                      "space-y-1 rounded-md px-1 py-1 transition-colors",
                      isActive && "bg-background/80 shadow-[inset_3px_0_0_var(--foreground)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onHeadingClick(section.sectionId, section.sectionTitle)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      <span className="text-meta-sm font-semibold tabular-nums text-muted-foreground">
                        {String(sectionIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {section.sectionTitle}
                      </span>
                    </button>

                    <div className="space-y-0.5 pl-6">
                      {section.headings.slice(1).map((heading) => {
                        const key = `${heading.sectionId}-${heading.headingIndex}`;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onHeadingClick(heading.sectionId, heading.text)}
                            className={cn(
                              "block w-full truncate rounded-md px-2 py-1 text-left transition-colors duration-150",
                              heading.level === 1
                                ? "text-meta font-medium text-foreground/80"
                                : "text-meta text-muted-foreground",
                              "hover:bg-background/70 hover:text-foreground",
                            )}
                          >
                            {heading.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </nav>
        </div>
      </motion.div>

      {/* Collapse / expand toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Collapse outline panel" : "Expand outline panel"}
        style={{ left: isOpen ? "228px" : "0px" }}
        className={cn(
          "fixed top-[60px] z-10",
          "flex h-6 w-5 items-center justify-center",
          "rounded-r-md border border-l-0 border-border bg-background",
          "transition-[left] duration-200",
        )}
      >
        <ChevronLeft
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform duration-200",
            !isOpen && "rotate-180",
          )}
        />
      </button>
    </>
  );
}
