import React, { useState } from 'react';
import { FileText, Code2, FileDown, Loader2, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportModalProps {
  projectId: number;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

interface FormatOption {
  id: 'markdown' | 'html' | 'pdf';
  label: string;
  description: string;
  useCase: string;
  icon: React.ComponentType<{ className?: string }>;
  ext: string;
  mime: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Raw .md file with all sections concatenated',
    useCase: 'GitHub READMEs, wikis, version-controlled docs',
    icon: FileText,
    ext: 'md',
    mime: 'text/markdown',
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Styled single-page HTML with inline CSS',
    useCase: 'Internal portals, email attachments, quick hosting',
    icon: Code2,
    ext: 'html',
    mime: 'text/html',
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Print-ready PDF generated via WeasyPrint',
    useCase: 'Client handoffs, printed manuals, archive copies',
    icon: FileDown,
    ext: 'pdf',
    mime: 'application/pdf',
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  projectId,
  projectName,
  open,
  onClose,
}) => {
  const [selected, setSelected] = useState<FormatOption['id']>('markdown');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const selectedOption = FORMAT_OPTIONS.find(f => f.id === selected)!;

  const handleExport = async () => {
    setLoading(true);
    setDone(false);
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const res = await fetch(
        `${baseURL}/projects/${projectId}/export?format=${selected}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeName = projectName.replace(/[^\w\-. ]/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.${selectedOption.ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 2500);
      toast.success(`Exported as ${selectedOption.label}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Export Documentation</h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[300px]">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Options */}
        <div className="space-y-3 mb-6">
          {FORMAT_OPTIONS.map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = selected === fmt.id;
            return (
              <button
                key={fmt.id}
                onClick={() => setSelected(fmt.id)}
                className={cn(
                  'w-full flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:bg-accent/50',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'font-semibold text-sm',
                      isSelected ? 'text-primary' : 'text-foreground',
                    )}>
                      {fmt.label}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-mono',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}>
                      .{fmt.ext}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmt.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70 italic">Best for: {fmt.useCase}</p>
                </div>
                {/* Radio dot */}
                <div className={cn(
                  'mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  isSelected ? 'border-primary bg-primary' : 'border-border bg-background',
                )}>
                  {isSelected && <div className="h-full w-full rounded-full scale-50 bg-primary-foreground" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all',
              done
                ? 'bg-green-600 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
              loading && 'opacity-70 cursor-not-allowed',
            )}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : done ? (
              <><CheckCircle2 className="h-4 w-4" /> Downloaded!</>
            ) : (
              <><FileDown className="h-4 w-4" /> Export {selectedOption.label}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
