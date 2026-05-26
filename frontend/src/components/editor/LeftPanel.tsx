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
}

export function extractHeadings(sections: Section[]): HeadingItem[] {
  const result: HeadingItem[] = [];

  for (const section of sections) {
    const RE = /^(#{1,2})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    let headingIndex = 0;

    while ((match = RE.exec(section.content_md)) !== null) {
      result.push({
        level: match[1].length as 1 | 2,
        text: match[2].trim(),
        sectionId: section.id,
        headingIndex: headingIndex++,
      });
    }
  }

  return result;
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
  const headings = useMemo(() => extractHeadings(sections), [sections]);

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 220 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative h-full shrink-0 overflow-hidden border-r border-border/50 bg-background"
      >
        <div className="flex h-full w-[220px] flex-col">
          {/* Progress bar at very top */}
          <div className="h-0.5 w-full shrink-0 bg-muted">
            <div
              className="h-full bg-primary/60 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Heading list */}
          <nav
            aria-label="Document outline"
            className="flex-1 space-y-0.5 overflow-y-auto px-2 pt-6 scrollbar-hide"
          >
            {headings.length === 0 ? (
              <p className="px-3 text-sm text-muted-foreground">
                Add headings to your content to see them here.
              </p>
            ) : (
              headings.map((heading) => {
                const isActive = heading.sectionId === activeSectionId;
                const key = `${heading.sectionId}-${heading.headingIndex}`;

                if (heading.level === 1) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onHeadingClick(heading.sectionId, heading.text)}
                      className={cn(
                        "block w-full truncate rounded-md px-3 py-1.5 text-left text-sm font-medium",
                        "mx-1 cursor-pointer transition-colors duration-150",
                        isActive
                          ? "bg-accent/60 text-foreground"
                          : "text-foreground hover:bg-accent/40"
                      )}
                    >
                      {heading.text}
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onHeadingClick(heading.sectionId, heading.text)}
                    className={cn(
                      "block w-full truncate rounded-md py-1 pl-6 pr-3 text-left text-sm",
                      "mx-1 cursor-pointer transition-colors duration-150",
                      isActive
                        ? "bg-accent/50 text-foreground"
                        : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                    )}
                  >
                    {heading.text}
                  </button>
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
        style={{ left: isOpen ? "208px" : "0px" }}
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
