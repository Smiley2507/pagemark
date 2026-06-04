import React, { useState, useEffect } from 'react';
import { FileText, Code2, FileDown, Loader2, X, CheckCircle2, Palette, FileType, Image, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { projectsApi } from '@/api/projects';
import { LogoUploader } from '@/components/ui/LogoUploader';
import type { ExportSettings } from '@/types';

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (default)' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
];

interface ExportModalProps {
  projectId: number;
  projectName: string;
  open: boolean;
  onClose: () => void;
  initialSettings?: ExportSettings;
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
  initialSettings,
}) => {
  const [selected, setSelected] = useState<FormatOption['id']>('markdown');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color || '#2563eb');
  const [fontFamily, setFontFamily] = useState(initialSettings?.font_family || 'Inter, sans-serif');
  const [batchMode, setBatchMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialSettings) {
      setLogoUrl(initialSettings.logo_url || '');
      setPrimaryColor(initialSettings.primary_color || '#2563eb');
      setFontFamily(initialSettings.font_family || 'Inter, sans-serif');
    }
  }, [open, initialSettings]);

  if (!open) return null;

  const selectedOption = FORMAT_OPTIONS.find(f => f.id === selected)!;

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(projectId, {
        export_settings: { logo_url: logoUrl || null, primary_color: primaryColor, font_family: fontFamily },
      });
      toast.success('Export settings saved');
    } catch {
      toast.error('Failed to save export settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setDone(false);
    try {
      if (batchMode) {
        const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
        const res = await fetch(`${baseURL}/projects/batch-export`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_ids: [projectId], export_settings: { logo_url: logoUrl || null, primary_color: primaryColor, font_family: fontFamily } }),
        });
        if (!res.ok) throw new Error(`Batch export failed (HTTP ${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName.replace(/[^\w\-. ]/g, '_')}-batch.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
        const params = new URLSearchParams({ format: selected });
        if (primaryColor) params.set('primary_color', primaryColor);
        if (fontFamily) params.set('font_family', fontFamily);
        if (logoUrl) params.set('logo_url', logoUrl);
        const res = await fetch(`${baseURL}/projects/${projectId}/export?${params}`, { credentials: 'include' });
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
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      toast.success(batchMode ? 'Batch export complete' : `Exported as ${selectedOption.label}`);
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
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

        {/* Branding Controls */}
        {(selected === 'html' || selected === 'pdf') && (
          <div className="mb-6 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="h-4 w-4" />
              Branding
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <FileType className="mr-1 inline h-3 w-3" />
                  Font
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  style={{ fontFamily }}
                >
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                <Image className="mr-1 inline h-3 w-3" />
                Logo
              </label>
              <LogoUploader value={logoUrl} onChange={setLogoUrl} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>
        )}

        {/* Batch Export Toggle */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Batch ZIP export</p>
              <p className="text-xs text-muted-foreground">Export as ZIP (multiple projects)</p>
            </div>
          </div>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              batchMode ? 'bg-primary' : 'bg-border',
            )}
          >
            <span className={cn(
              'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              batchMode && 'translate-x-4',
            )} />
          </button>
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
