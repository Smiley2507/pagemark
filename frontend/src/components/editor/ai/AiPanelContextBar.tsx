import { useState, useRef, useEffect } from 'react';
import { FileText, X, BookOpen, FileCode, Layout, Sparkles, Circle, Highlighter, ExternalLink, ShieldCheck, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAiStore } from '@/store/aiStore';
import { ResourcePreview } from './ResourcePreview';
import { projectsApi } from '@/api/projects';
import { Popover } from '@/components/ui/popover';

const ATTACHMENT_ICONS: Record<string, typeof FileText> = {
  file: FileText,
  note: BookOpen,
  section: FileText,
  document: BookOpen,
  source: FileCode,
  template: Layout,
  transient: Highlighter,
};

const TYPE_DOT_COLORS: Record<string, string> = {
  file: 'bg-blue-400',
  note: 'bg-amber-400',
  section: 'bg-emerald-400',
  document: 'bg-violet-400',
  source: 'bg-cyan-400',
  template: 'bg-orange-400',
  transient: 'bg-pink-400',
};

interface AiPanelContextBarProps {
  projectId: number;
  activeSectionHeading: string | null;
  activeSectionStatus?: string;
  hasQualityContext?: boolean;
}

export function AiPanelContextBar({
  projectId,
  activeSectionHeading,
  activeSectionStatus,
  hasQualityContext = false,
}: AiPanelContextBarProps) {
  const { contextBarOpen, attachments, removeAttachment, clearAttachments } = useAiStore();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { data: aiContext } = useQuery({
    queryKey: ['ai-context', projectId],
    queryFn: () => projectsApi.getAiContext(projectId),
    enabled: contextBarOpen && projectId > 0,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewId(null);
      }
    };
    if (previewId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [previewId]);

  if (!contextBarOpen) return null;

  const hasProjectBrief = Boolean(aiContext?.project_brief?.trim());
  const hasAnalysis = aiContext?.analysis_summary.status === 'completed';
  const hasSourceFacts = Boolean(
    (aiContext?.analysis_summary.total_files || 0) > 0 ||
    (aiContext?.analysis_summary.endpoint_count || 0) > 0 ||
    (aiContext?.analysis_summary.dependency_count || 0) > 0,
  );
  const languageFacts = aiContext?.analysis_summary.languages?.slice(0, 2).join(', ');
  const frameworkFacts = aiContext?.analysis_summary.frameworks?.slice(0, 2).join(', ');
  const warnings = aiContext?.grounding_warnings?.slice(0, 2) ?? [];
  const hasTemplate = attachments.some((a) => a.type === 'template');
  const hasContext = activeSectionHeading || attachments.length > 0 || hasProjectBrief || hasAnalysis || hasSourceFacts || warnings.length > 0 || hasQualityContext;
  const fileAttachmentCount = attachments.filter((a) => a.type === 'file' || a.type === 'source').length;
  const contextItemCount = [
    activeSectionHeading,
    hasProjectBrief,
    hasAnalysis,
    hasSourceFacts,
    languageFacts || frameworkFacts,
    hasQualityContext,
    hasTemplate,
    ...warnings,
    ...attachments,
  ].filter(Boolean).length;
  const indicators = [
    activeSectionHeading ? 'Section' : null,
    fileAttachmentCount > 0
      ? `Files ${fileAttachmentCount}`
      : hasSourceFacts
        ? `Files ${aiContext?.analysis_summary.total_files || 0}`
        : null,
    hasQualityContext ? 'Quality' : null,
    hasProjectBrief ? 'Brief' : null,
    hasAnalysis ? 'Analysis' : null,
  ].filter(Boolean).slice(0, 3);

  return (
    <div className="shrink-0 border-b border-separator bg-canvas/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3 w-3 shrink-0 text-indigo-500/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Using context
        </span>

        <Popover
          className="w-[22rem] p-0"
          trigger={(
            <span className="inline-flex max-w-full items-center gap-1.5 rounded bg-panel-muted px-2 py-1 text-[10px] text-text-secondary transition-colors hover:bg-interaction-muted hover:text-interaction-hover">
              <span className="font-medium text-text-primary">
                {hasContext ? `Using ${contextItemCount} context item${contextItemCount === 1 ? '' : 's'}` : 'No context selected'}
              </span>
              {indicators.map((indicator) => (
                <span key={indicator} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-text-muted">
                  {indicator}
                </span>
              ))}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </span>
          )}
        >
          <div className="max-h-[28rem] overflow-y-auto p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-text-primary">AI context</p>
                <p className="text-[10px] text-text-muted">
                  {hasContext ? `${contextItemCount} item${contextItemCount === 1 ? '' : 's'} available to chat` : 'No context selected'}
                </p>
              </div>
              {attachments.length > 0 && (
                <button
                  type="button"
                  onClick={() => { clearAttachments(); setPreviewId(null); }}
                  className="rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {activeSectionHeading && (
                <div className="flex items-center gap-2 rounded border border-separator bg-panel px-2 py-1.5 text-[11px] text-text-secondary">
                  <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400" />
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{activeSectionHeading}</span>
                  {activeSectionStatus && (
                    <span className="rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-muted">{activeSectionStatus}</span>
                  )}
                </div>
              )}

              {hasProjectBrief && (
                <div className="flex items-center gap-2 rounded border border-separator bg-panel px-2 py-1.5 text-[11px] text-text-secondary">
                  <Circle className="h-1.5 w-1.5 fill-amber-400 text-amber-400" />
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>Project brief</span>
                </div>
              )}

              {hasAnalysis && (
                <div className="flex items-center gap-2 rounded border border-separator bg-panel px-2 py-1.5 text-[11px] text-text-secondary">
                  <Circle className="h-1.5 w-1.5 fill-cyan-400 text-cyan-400" />
                  <FileCode className="h-3.5 w-3.5 shrink-0" />
                  <span>{aiContext?.analysis_summary.is_current ? 'Latest analysis' : 'Analysis may be stale'}</span>
                </div>
              )}

              {hasSourceFacts && (
                <div className="flex items-center gap-2 rounded border border-separator bg-panel px-2 py-1.5 text-[11px] text-text-secondary">
                  <Circle className="h-1.5 w-1.5 fill-blue-400 text-blue-400" />
                  <FileCode className="h-3.5 w-3.5 shrink-0" />
                  <span>{aiContext?.analysis_summary.total_files || 0} files</span>
                </div>
              )}

              {(languageFacts || frameworkFacts) && (
                <div className="flex items-center gap-2 rounded border border-separator bg-panel px-2 py-1.5 text-[11px] text-text-secondary">
                  <Circle className="h-1.5 w-1.5 fill-violet-400 text-violet-400" />
                  <FileCode className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{[languageFacts, frameworkFacts].filter(Boolean).join(' / ')}</span>
                </div>
              )}

              {warnings.map((warning, index) => (
                <div key={`${warning}-${index}`} className="flex items-center gap-2 rounded border border-status-warning/30 bg-status-warning/15 px-2 py-1.5 text-[11px] text-status-warning-foreground">
                  <Circle className="h-1.5 w-1.5 fill-current" />
                  <span className="min-w-0 flex-1 truncate">{warning}</span>
                </div>
              ))}

              {hasQualityContext && (
                <div className="flex items-center gap-2 rounded border border-status-warning/30 bg-status-warning/15 px-2 py-1.5 text-[11px] text-status-warning-foreground">
                  <Circle className="h-1.5 w-1.5 fill-current" />
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Quality context</span>
                </div>
              )}

              {attachments.map((a) => {
                const Icon = ATTACHMENT_ICONS[a.type];
                const dotColor = TYPE_DOT_COLORS[a.type] || 'bg-text-muted';
                const showPreview = previewId === a.id;

                return (
                  <div key={a.id} className="relative">
                    <div className="flex items-center rounded border border-separator bg-panel text-[11px] text-text-secondary transition-colors hover:bg-interaction-muted hover:text-interaction-hover">
                      <button
                        type="button"
                        onClick={() => setPreviewId(showPreview ? null : a.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                      >
                        <Circle className={`h-1.5 w-1.5 fill-current ${dotColor.replace('bg-', 'text-')}`} />
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{a.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { removeAttachment(a.id); setPreviewId(null); }}
                        className="mr-1 rounded p-1 text-text-muted hover:text-text-primary"
                        aria-label={`Remove ${a.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {showPreview && (
                      <div
                        ref={previewRef}
                        className="absolute bottom-full right-0 z-50 mb-1.5"
                      >
                        <ResourcePreview
                          attachment={a}
                          onRemove={(id) => { removeAttachment(id); setPreviewId(null); }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-separator pt-2">
              <Link
                to={`/projects/${projectId}/source`}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-text-muted transition-colors hover:text-text-primary"
              >
                AI Context
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
}
