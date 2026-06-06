import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Code2, FileDown, Loader2, X, CheckCircle2, Palette, FileType, Image, Package, Eye, RefreshCw, AlignLeft, AlignCenter, AlignRight, BookOpen, Ruler } from 'lucide-react';
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

const LOGO_POSITIONS = [
  { value: 'title-page', label: 'Title page (centered)' },
  { value: 'header-left', label: 'Header left' },
  { value: 'header-center', label: 'Header center' },
  { value: 'header-right', label: 'Header right' },
  { value: 'none', label: 'None (don\'t show)' },
];

const PAPER_SIZES = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
];

const MARGIN_OPTIONS = [
  { value: 'normal', label: 'Normal (2cm)' },
  { value: 'narrow', label: 'Narrow (1cm)' },
  { value: 'wide', label: 'Wide (3cm)' },
];

interface ExportModalProps {
  projectId: number;
  documentId?: number;
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
  documentId,
  projectName,
  open,
  onClose,
  initialSettings,
}) => {
  const [selected, setSelected] = useState<FormatOption['id']>('markdown');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url || '');
  const [logoPosition, setLogoPosition] = useState(initialSettings?.logo_position || 'title-page');
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color || '#2563eb');
  const [h1Color, setH1Color] = useState(initialSettings?.h1_color || '#0F172A');
  const [h2Color, setH2Color] = useState(initialSettings?.h2_color || '#0F172A');
  const [fontFamily, setFontFamily] = useState(initialSettings?.font_family || 'Inter, sans-serif');
  const [headerLeft, setHeaderLeft] = useState(initialSettings?.header_left || '');
  const [headerCenter, setHeaderCenter] = useState(initialSettings?.header_center || '');
  const [headerRight, setHeaderRight] = useState(initialSettings?.header_right || '');
  const [pageNumbers, setPageNumbers] = useState(initialSettings?.page_numbers ?? false);
  const [paperSize, setPaperSize] = useState(initialSettings?.paper_size || 'a4');
  const [margins, setMargins] = useState(initialSettings?.margins || 'normal');
  const [batchMode, setBatchMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open && initialSettings) {
      setLogoUrl(initialSettings.logo_url || '');
      setLogoPosition(initialSettings.logo_position || 'title-page');
      setPrimaryColor(initialSettings.primary_color || '#2563eb');
      setH1Color(initialSettings.h1_color || '#0F172A');
      setH2Color(initialSettings.h2_color || '#0F172A');
      setFontFamily(initialSettings.font_family || 'Inter, sans-serif');
      setHeaderLeft(initialSettings.header_left || '');
      setHeaderCenter(initialSettings.header_center || '');
      setHeaderRight(initialSettings.header_right || '');
      setPageNumbers(initialSettings.page_numbers ?? false);
      setPaperSize(initialSettings.paper_size || 'a4');
      setMargins(initialSettings.margins || 'normal');
    }
  }, [open, initialSettings]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ format: selected });
    if (primaryColor) params.set('primary_color', primaryColor);
    if (h1Color) params.set('h1_color', h1Color);
    if (h2Color) params.set('h2_color', h2Color);
    if (fontFamily) params.set('font_family', fontFamily);
    if (logoUrl) params.set('logo_url', logoUrl);
    if (logoPosition) params.set('logo_position', logoPosition);
    if (headerLeft) params.set('header_left', headerLeft);
    if (headerCenter) params.set('header_center', headerCenter);
    if (headerRight) params.set('header_right', headerRight);
    if (pageNumbers) params.set('page_numbers', 'true');
    if (paperSize) params.set('paper_size', paperSize);
    if (margins) params.set('margins', margins);
    return params;
  }, [selected, primaryColor, h1Color, h2Color, fontFamily, logoUrl, logoPosition, headerLeft, headerCenter, headerRight, pageNumbers, paperSize, margins]);

  if (!open) return null;

  const selectedOption = FORMAT_OPTIONS.find(f => f.id === selected)!;

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(projectId, {
        export_settings: {
          logo_url: logoUrl || null,
          logo_position: logoPosition,
          primary_color: primaryColor,
          h1_color: h1Color,
          h2_color: h2Color,
          font_family: fontFamily,
          header_left: headerLeft || undefined,
          header_center: headerCenter || undefined,
          header_right: headerRight || undefined,
          page_numbers: pageNumbers,
          paper_size: paperSize,
          margins: margins,
        },
      });
      toast.success('Export settings saved');
    } catch {
      toast.error('Failed to save export settings');
    } finally {
      setSaving(false);
    }
  };

  const doExport = async (params: URLSearchParams, preview: boolean) => {
    const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
    const exportPath = documentId
      ? `/projects/${projectId}/documents/${documentId}/export`
      : `/projects/${projectId}/export`;
    if (preview) {
      params.set('format', 'html');
    }
    const res = await fetch(`${baseURL}${exportPath}?${params}`, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res;
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const params = buildParams();
      const res = await doExport(params, true);
      const html = await res.text();
      setPreviewHtml(html);
    } catch (err: any) {
      toast.error(err.message ?? 'Preview failed');
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
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
        const params = buildParams();
        const exportPath = documentId
          ? `/projects/${projectId}/documents/${documentId}/export`
          : `/projects/${projectId}/export`;
        const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
        const res = await fetch(`${baseURL}${exportPath}?${params}`, { credentials: 'include' });
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

      <div className="relative z-10 flex w-full max-w-4xl gap-4 max-h-[90vh] min-h-0">
        {/* Settings Panel */}
        <div className="w-[480px] shrink-0 rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-y-auto">
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
                      <span className={cn('font-semibold text-sm', isSelected ? 'text-primary' : 'text-foreground')}>
                        {fmt.label}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-mono', isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                        .{fmt.ext}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{fmt.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70 italic">Best for: {fmt.useCase}</p>
                  </div>
                  <div className={cn('mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors', isSelected ? 'border-primary bg-primary' : 'border-border bg-background')}>
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
                Branding & Layout
              </div>

              {/* Colors row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Primary</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0 shrink-0" />
                    <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">H1 Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={h1Color} onChange={(e) => setH1Color(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0 shrink-0" />
                    <input type="text" value={h1Color} onChange={(e) => setH1Color(e.target.value)}
                      className="flex-1 w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">H2 Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={h2Color} onChange={(e) => setH2Color(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0 shrink-0" />
                    <input type="text" value={h2Color} onChange={(e) => setH2Color(e.target.value)}
                      className="flex-1 w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono" />
                  </div>
                </div>
              </div>

              {/* Font */}
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

              {/* Logo + Position */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <Image className="mr-1 inline h-3 w-3" />
                  Logo
                </label>
                <LogoUploader value={logoUrl} onChange={setLogoUrl} />
              </div>
              {logoUrl && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Logo Position</label>
                  <select
                    value={logoPosition}
                    onChange={(e) => setLogoPosition(e.target.value as typeof logoPosition)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  >
                    {LOGO_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Header fields */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <BookOpen className="mr-1 inline h-3 w-3" />
                  Header
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1">
                    <AlignLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                    <input type="text" value={headerLeft} onChange={(e) => setHeaderLeft(e.target.value)}
                      placeholder="Left" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <AlignCenter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <input type="text" value={headerCenter} onChange={(e) => setHeaderCenter(e.target.value)}
                      placeholder="Center" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <AlignRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <input type="text" value={headerRight} onChange={(e) => setHeaderRight(e.target.value)}
                      placeholder="Right" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                </div>
              </div>

              {/* Page numbers */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Page numbers</label>
                <button
                  onClick={() => setPageNumbers(!pageNumbers)}
                  className={cn('relative h-5 w-9 rounded-full transition-colors', pageNumbers ? 'bg-primary' : 'bg-border')}
                >
                  <span className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform', pageNumbers && 'translate-x-4')} />
                </button>
              </div>

              {/* Paper & margins (PDF only) */}
              {selected === 'pdf' && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      <Ruler className="mr-1 inline h-3 w-3" />
                      Paper Size
                    </label>
                    <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as typeof paperSize)}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                      {PAPER_SIZES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Margins</label>
                    <select value={margins} onChange={(e) => setMargins(e.target.value as typeof margins)}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                      {MARGIN_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
              className={cn('relative h-5 w-9 rounded-full transition-colors', batchMode ? 'bg-primary' : 'bg-border')}
            >
              <span className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform', batchMode && 'translate-x-4')} />
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
            {(selected === 'html' || selected === 'pdf') && (
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={loading}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all',
                done ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90',
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

        {/* Preview Panel */}
        {(showPreview && (selected === 'html' || selected === 'pdf')) && (
          <div className="flex-1 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col min-w-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Eye className="h-4 w-4" />
                Preview
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  <RefreshCw className={cn('h-3 w-3', previewLoading && 'animate-spin')} />
                  Refresh
                </button>
                <button
                  onClick={() => { setShowPreview(false); setPreviewHtml(null); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              {previewHtml ? (
                <iframe
                  ref={previewIframeRef}
                  srcDoc={previewHtml}
                  className="h-full w-full border-0"
                  title="Export preview"
                  sandbox="allow-same-origin"
                />
              ) : previewLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
