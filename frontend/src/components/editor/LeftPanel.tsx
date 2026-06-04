import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Section } from '@/types';

export interface HeadingItem {
  level: 1 | 2;
  text: string;
  sectionId: number;
  headingIndex: number;
  isSectionTitle: boolean;
}

interface LeftPanelProps {
  sections: Section[];
  activeSectionId: number | null;
  onHeadingClick: (sectionId: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function extractHeadings(sections: Section[]): HeadingItem[] {
  const items: HeadingItem[] = [];

  for (const section of sections) {
    const sectionTitle = section.title?.trim() ? section.title : section.heading;
    items.push({
      level: 1,
      text: sectionTitle,
      sectionId: section.id,
      headingIndex: -1,
      isSectionTitle: true,
    });

    const re = /^(#{1,2})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = re.exec(section.content_md)) !== null) {
      items.push({
        level: match[1].length as 1 | 2,
        text: match[2].trim(),
        sectionId: section.id,
        headingIndex: idx++,
        isSectionTitle: false,
      });
    }
  }

  return items;
}

function computeWordCount(sections: Section[]): number {
  return sections.reduce((sum, s) => {
    const text = s.content_md?.replace(/#{1,6}\s+/g, '').replace(/[*_~`]/g, '') ?? '';
    return sum + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

export function LeftPanel({
  sections,
  activeSectionId,
  onHeadingClick,
  isOpen,
  onToggle,
}: LeftPanelProps) {
  const headings = useMemo(() => extractHeadings(sections), [sections]);
  const wordCount = useMemo(() => computeWordCount(sections), [sections]);

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 240 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative h-full shrink-0 overflow-hidden border-r border-border bg-background"
      >
        <div className="flex h-full w-[240px] flex-col">
          <div className="px-3 py-3 border-b border-border">
            <h3 className="text-meta-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Outline
            </h3>
          </div>

          <nav
            aria-label="Document outline"
            className="flex-1 overflow-y-auto py-2 scrollbar-hide"
          >
            {headings.length === 0 ? (
              <p className="px-4 py-6 text-meta text-muted-foreground text-center">
                No headings yet
              </p>
            ) : (
              <div className="space-y-0.5 px-2">
                {headings.map((h, i) => {
                  const isActive = h.sectionId === activeSectionId;
                  return (
                    <button
                      key={`${h.sectionId}-${h.headingIndex}-${i}`}
                      type="button"
                      onClick={() => onHeadingClick(h.sectionId)}
                      className={cn(
                        'block w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        h.level === 2 && 'pl-7 text-meta',
                        h.isSectionTitle && 'font-medium'
                      )}
                    >
                      <span className="truncate block">{h.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          <div className="border-t border-border px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>{wordCount.toLocaleString()} words</span>
            </div>
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Quality & grammar —</span>
            </div>
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse outline panel' : 'Expand outline panel'}
        style={{ left: isOpen ? '228px' : '0px' }}
        className={cn(
          'fixed top-[60px] z-10',
          'flex h-6 w-5 items-center justify-center',
          'rounded-r-md border border-l-0 border-border bg-background',
          'transition-[left] duration-200',
        )}
      >
        <ChevronLeft
          className={cn(
            'h-3 w-3 text-muted-foreground transition-transform duration-200',
            !isOpen && 'rotate-180',
          )}
        />
      </button>
    </>
  );
}
