import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PanelRightOpen, Plus, CheckCheck, RotateCw, FileText, Sparkles, BookOpen, ShieldCheck, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { QualityReportFull } from '@/api/quality';
import type { KeyboardEvent } from 'react';

export type TocItem = {
  id: string;
  label: string;
  kind: 'section' | 'h1' | 'h2';
  sectionId: number;
};

interface OutlinePanelProps {
  tocItems: TocItem[];
  activeTocId: string | null;
  onTocItemClick: (item: TocItem) => void;
  onTocKeyboard: (e: KeyboardEvent<HTMLButtonElement>) => void;
  wordCount: number;
  reviewedCount: number;
  reviewTotal: number;
  qualityData: QualityReportFull | null | undefined;
  canAcceptAll: boolean;
  onAcceptAll: () => void;
  onRunQuality: () => void;
  onCreateSection: () => void;
  onClose: () => void;
  onReorderSections?: (sectionIds: number[]) => void;
}

function StatDot(className: string) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', className)} />;
}

function SortableTocItem({
  item,
  isActive,
  onClick,
  onKeyboard,
}: {
  item: TocItem;
  isActive: boolean;
  onClick: () => void;
  onKeyboard: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const isDraggable = item.kind === 'section';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-0.5 rounded py-1 pr-2 transition-all duration-150',
        isDragging && 'opacity-50 shadow-md z-10',
        isActive && !isDragging ? 'bg-interaction-muted' : 'hover:bg-panel-muted',
      )}
    >
      {isDraggable && (
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label={`Drag ${item.label}`}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {!isDraggable && <span className="w-5 shrink-0" />}
      <button
        type="button"
        data-toc-item="true"
        onClick={onClick}
        onKeyDown={onKeyboard}
        className={cn(
          'flex-1 text-left text-meta focus-visible:ring-2 focus-visible:ring-ring',
          item.kind === 'h1' && 'pl-6',
          item.kind === 'h2' && 'pl-8',
          isActive && !isDragging
            ? 'text-interaction-hover font-medium'
            : 'text-text-muted opacity-60 hover:opacity-100 hover:text-text-primary',
        )}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className="block truncate">{item.label}</span>
      </button>
    </div>
  );
}

export function OutlinePanel({
  tocItems,
  activeTocId,
  onTocItemClick,
  onTocKeyboard,
  wordCount,
  reviewedCount,
  reviewTotal,
  qualityData,
  canAcceptAll,
  onAcceptAll,
  onRunQuality,
  onCreateSection,
  onClose,
  onReorderSections,
}: OutlinePanelProps) {
  const [showSubScores, setShowSubScores] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionItems = tocItems.filter(i => i.kind === 'section');
  const sectionIds = sectionItems.map(i => i.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionItems.findIndex(i => i.id === active.id);
    const newIndex = sectionItems.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = [...sectionItems];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);

    onReorderSections?.(newOrder.map(i => i.sectionId));
  };

  const reviewDot =
    reviewTotal === 0 ? 'bg-text-muted' :
    reviewedCount >= reviewTotal ? 'bg-status-success-foreground' :
    reviewedCount > 0 ? 'bg-status-warning-foreground' :
    'bg-status-danger-foreground';

  const qualityDot =
    qualityData == null ? 'bg-text-muted' :
    qualityData.overall_score >= 80 ? 'bg-status-success-foreground' :
    qualityData.overall_score >= 60 ? 'bg-status-warning-foreground' :
    'bg-status-danger-foreground';

  const qualityIssues = qualityData?.issues ?? [];
  const brokenLinks = qualityData?.broken_links ?? [];
  const hasErrorIssues = qualityIssues.some((i) => i.severity === 'error');

  const issueDot =
    qualityData == null ? 'bg-text-muted' :
    qualityIssues.length === 0 ? 'bg-status-success-foreground' :
    hasErrorIssues ? 'bg-status-danger-foreground' :
    'bg-status-warning-foreground';

  const brokenLinkDot =
    qualityData == null ? 'bg-text-muted' :
    brokenLinks.length === 0 ? 'bg-status-success-foreground' :
    'bg-status-danger-foreground';

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-canvas">
      <div className="flex items-center justify-between px-3 h-11">
        <p className="text-meta-sm font-medium uppercase text-text-muted tracking-wider">Outline</p>
        <div className="flex items-center gap-1">
          {canAcceptAll && (
            <button
              onClick={onAcceptAll}
              className="rounded p-1 text-text-muted transition-colors hover:bg-interaction-muted hover:text-interaction-hover"
              title="Accept all review-ready sections"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted transition-colors hover:bg-interaction-muted hover:text-primary"
            aria-label="Close outline panel"
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav aria-label="Document table of contents" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {tocItems.map((item) => {
              const isActive = activeTocId === item.id || activeTocId === `section-${item.sectionId}`;
              return (
                <SortableTocItem
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  onClick={() => onTocItemClick(item)}
                  onKeyboard={onTocKeyboard}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        {tocItems.length === 0 && (
          <Button type="button" size="sm" onClick={onCreateSection} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        )}
      </nav>

      <div className="px-3 pb-3 pt-1">
        <div className="rounded-lg border border-separator bg-panel px-4 py-3 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-meta-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <FileText className="h-3 w-3" />
                Words
              </span>
              <span className="font-medium text-text-primary">{wordCount.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between gap-2 text-meta-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <Sparkles className="h-3 w-3" />
                Review
              </span>
              <span className="flex items-center gap-1.5">
                {StatDot(reviewDot)}
                <span className="font-medium text-text-primary">{reviewedCount}/{reviewTotal}</span>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 text-meta-sm">
                <button
                  onClick={() => setShowSubScores(!showSubScores)}
                  className="flex items-center gap-1.5 text-text-muted cursor-pointer"
                  title="Toggle quality sub-scores"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Quality
                </button>
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={onRunQuality}
                    className="rounded p-0.5 text-text-muted transition-colors hover:bg-interaction-muted hover:text-interaction-hover cursor-pointer"
                    title="Run quality analysis"
                  >
                    <RotateCw className="h-2.5 w-2.5" />
                  </button>
                  {StatDot(qualityDot)}
                  <span className="font-medium text-text-primary">
                    {qualityData != null ? `${Math.round(qualityData.overall_score)}%` : '\u2014'}
                  </span>
                </span>
              </div>
              {showSubScores && qualityData && (
                <div className="ml-5 mt-1 space-y-1 border-l border-separator pl-2">
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Completeness</span>
                    <span className="font-medium">{Math.round(qualityData.completeness)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Readability</span>
                    <span className="font-medium">{Math.round(qualityData.readability)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Consistency</span>
                    <span className="font-medium">{Math.round(qualityData.consistency)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Accuracy</span>
                    <span className="font-medium">{Math.round(qualityData.accuracy)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-meta-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <BookOpen className="h-3 w-3" />
                Issues
              </span>
              <span className="flex items-center gap-1.5">
                {StatDot(issueDot)}
                <span className="font-medium text-text-primary">{qualityIssues.length}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-meta-sm">
              <span className="flex items-center gap-1.5 text-text-muted">
                <BookOpen className="h-3 w-3" />
                Broken links
              </span>
              <span className="flex items-center gap-1.5">
                {StatDot(brokenLinkDot)}
                <span className="font-medium text-text-primary">{brokenLinks.length}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
