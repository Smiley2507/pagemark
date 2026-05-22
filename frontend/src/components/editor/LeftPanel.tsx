import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, PanelLeftClose } from 'lucide-react';
import type { Section } from '@/types';
import { countSectionProgress } from '@/lib/sections';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<Section['status'], string> = {
  pending: 'bg-muted-foreground',
  draft: 'bg-amber-500',
  finalized: 'bg-emerald-500',
};

interface LeftPanelProps {
  sections: Section[];
  activeSectionId: number | null;
  onSectionClick: (id: number) => void;
  onCollapse?: () => void;
}

function SectionRow({
  section,
  depth,
  activeSectionId,
  onSectionClick,
}: {
  section: Section;
  depth: number;
  activeSectionId: number | null;
  onSectionClick: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = (section.children?.length ?? 0) > 0;
  const isActive = activeSectionId === section.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSectionClick(section.id)}
        className={cn(
          'relative flex h-8 w-full items-center gap-2 rounded-md px-3 text-left text-body transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
        )}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {isActive && (
          <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-primary" />
        )}
        {hasChildren ? (
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="shrink-0"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[section.status])}
          aria-hidden
        />
        <span className="truncate">{section.heading}</span>
      </button>
      {hasChildren && open && (
        <div>
          {section.children!.map((child) => (
            <SectionRow
              key={child.id}
              section={child}
              depth={depth + 1}
              activeSectionId={activeSectionId}
              onSectionClick={onSectionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LeftPanel({
  sections,
  activeSectionId,
  onSectionClick,
  onCollapse,
}: LeftPanelProps) {
  const { total, finalized, pct } = countSectionProgress(sections);

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-meta-sm font-medium uppercase tracking-wide text-muted-foreground">
          Contents
        </span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Collapse panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex justify-between text-meta-sm text-muted-foreground">
          <span>
            {finalized}/{total} finalized
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <SectionRow
            key={section.id}
            section={section}
            depth={0}
            activeSectionId={activeSectionId}
            onSectionClick={onSectionClick}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          className="flex items-center gap-2 text-meta text-muted-foreground hover:text-foreground"
        >
          <FileText className="h-4 w-4" />
          Context file
        </button>
      </div>
    </div>
  );
}
