import { useState, useRef, useEffect } from 'react';
import { FileText, X, BookOpen, FileCode, Layout, Sparkles, Circle, Highlighter, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAiStore } from '@/store/aiStore';
import { ResourcePreview } from './ResourcePreview';
import { projectsApi } from '@/api/projects';

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

  return (
    <div className="shrink-0 border-b border-separator bg-canvas/80 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 shrink-0 text-indigo-500/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Using context
        </span>

        <div className="ml-1 flex flex-1 flex-wrap gap-1">
          {activeSectionHeading && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400" />
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[80px] truncate">{activeSectionHeading}</span>
              {activeSectionStatus && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-interaction" />
              )}
            </span>
          )}

          {hasProjectBrief && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-amber-400 text-amber-400" />
              <BookOpen className="h-3 w-3 shrink-0" />
              <span>Project brief</span>
            </span>
          )}

          {hasAnalysis && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-cyan-400 text-cyan-400" />
              <FileCode className="h-3 w-3 shrink-0" />
              <span>{aiContext?.analysis_summary.is_current ? 'Using latest analysis' : 'Analysis may be stale'}</span>
            </span>
          )}

          {hasSourceFacts && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-blue-400 text-blue-400" />
              <FileCode className="h-3 w-3 shrink-0" />
              <span>{aiContext?.analysis_summary.total_files || 0} files</span>
            </span>
          )}

          {(languageFacts || frameworkFacts) && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-violet-400 text-violet-400" />
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="max-w-[120px] truncate">{[languageFacts, frameworkFacts].filter(Boolean).join(' / ')}</span>
            </span>
          )}

          {warnings.map((warning, index) => (
            <span key={`${warning}-${index}`} className="inline-flex items-center gap-1 rounded bg-status-warning px-1.5 py-0.5 text-[10px] text-status-warning-foreground">
              <Circle className="h-1.5 w-1.5 fill-current" />
              <span className="max-w-[120px] truncate">{warning}</span>
            </span>
          ))}

          {hasQualityContext && (
            <span className="inline-flex items-center gap-1 rounded bg-status-warning/20 px-1.5 py-0.5 text-[10px] text-status-warning-foreground">
              <Circle className="h-1.5 w-1.5 fill-current" />
              <ShieldCheck className="h-3 w-3 shrink-0" />
              <span>Quality Context</span>
            </span>
          )}

          {hasTemplate && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <Circle className="h-1.5 w-1.5 fill-orange-400 text-orange-400" />
              <Layout className="h-3 w-3 shrink-0" />
              <span>Template</span>
            </span>
          )}

          {attachments.map((a) => {
            const Icon = ATTACHMENT_ICONS[a.type];
            const dotColor = TYPE_DOT_COLORS[a.type] || 'bg-text-muted';
            const showPreview = previewId === a.id;

            return (
              <span key={a.id} className="relative inline-flex">
                <span className="inline-flex items-center rounded bg-panel-muted text-[10px] text-text-secondary transition-colors hover:bg-interaction-muted hover:text-interaction-hover">
                  <button
                    type="button"
                    onClick={() => setPreviewId(showPreview ? null : a.id)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5"
                  >
                    <Circle className={`h-1.5 w-1.5 fill-current ${dotColor.replace('bg-', 'text-')}`} />
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="max-w-[60px] truncate">{a.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { removeAttachment(a.id); setPreviewId(null); }}
                    className="mr-1 rounded-sm text-text-muted hover:text-text-primary"
                    aria-label={`Remove ${a.label}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>

                {showPreview && (
                  <div
                    ref={previewRef}
                    className="absolute bottom-full left-0 z-50 mb-1.5"
                  >
                    <ResourcePreview
                      attachment={a}
                      onRemove={(id) => { removeAttachment(id); setPreviewId(null); }}
                    />
                  </div>
                )}
              </span>
            );
          })}

          {!hasContext && (
            <span className="text-[10px] text-text-muted italic">
              No context selected
            </span>
          )}
        </div>

        {attachments.length > 0 && (
          <button
            onClick={clearAttachments}
            className="shrink-0 rounded px-1 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text-primary"
          >
            Clear
          </button>
        )}
        <Link
          to={`/projects/${projectId}/source`}
          className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text-primary"
        >
          AI Context
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}
