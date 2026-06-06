import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Code2, FileDown, Loader2, X, CheckCircle2, Palette, FileType, Image, Package, Eye, AlignLeft, AlignCenter, AlignRight, BookOpen, Ruler, ChevronDown, ChevronRight } from 'lucide-react';
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
  { value: 'title-page', label: 'Title page (centred)' },
  { value: 'header-left', label: 'Header left' },
  { value: 'header-center', label: 'Header centre' },
  { value: 'header-right', label: 'Header right' },
  { value: 'footer-left', label: 'Footer left' },
  { value: 'footer-center', label: 'Footer centre' },
  { value: 'footer-right', label: 'Footer right' },
  { value: 'none', label: 'None' },
];

const LOGO_HEIGHTS = [
  { value: '30px', label: 'Small' },
  { value: '50px', label: 'Medium' },
  { value: '70px', label: 'Large' },
  { value: '90px', label: 'X-Large' },
  { value: '120px', label: 'XX-Large' },
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
  icon: React.ComponentType<{ className?: string }>;
  ext: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'markdown', label: 'Markdown', description: 'Raw .md file', icon: FileText, ext: 'md' },
  { id: 'html', label: 'HTML', description: 'Styled single-page HTML', icon: Code2, ext: 'html' },
  { id: 'pdf', label: 'PDF', description: 'Print-ready PDF via WeasyPrint', icon: FileDown, ext: 'pdf' },
];

function CollapsibleGroup({ title, icon: Icon, defaultOpen, children }: { title: string; icon: React.ComponentType<{ className?: string }>; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border-b border-border pb-3 mb-3 last:border-0 last:mb-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}

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
  const [logoPosition, setLogoPosition] = useState(initialSettings?.logo_position || 'header-left');
  const [logoHeight, setLogoHeight] = useState(initialSettings?.logo_height || '60px');
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color || '#2563eb');
  const [h1Color, setH1Color] = useState(initialSettings?.h1_color || '#0F172A');
  const [h2Color, setH2Color] = useState(initialSettings?.h2_color || '#0F172A');
  const [fontFamily, setFontFamily] = useState(initialSettings?.font_family || 'Inter, sans-serif');
  const [headerLeft, setHeaderLeft] = useState(initialSettings?.header_left || '');
  const [headerCenter, setHeaderCenter] = useState(initialSettings?.header_center || '');
  const [headerRight, setHeaderRight] = useState(initialSettings?.header_right || '');
  const [pageNumbers, setPageNumbers] = useState(initialSettings?.page_numbers ?? false);
  const [pageNumberPosition, setPageNumberPosition] = useState(initialSettings?.page_number_position || 'center');
  const [pageNumberFormat, setPageNumberFormat] = useState(initialSettings?.page_number_format || 'number');
  const [paperSize, setPaperSize] = useState(initialSettings?.paper_size || 'a4');
  const [margins, setMargins] = useState(initialSettings?.margins || 'normal');
  const [batchMode, setBatchMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const isPreviewable = selected === 'html' || selected === 'pdf';

  useEffect(() => {
    if (open && initialSettings) {
      setLogoUrl(initialSettings.logo_url || '');
      setLogoPosition(initialSettings.logo_position || 'header-left');
      setLogoHeight(initialSettings.logo_height || '60px');
      setPrimaryColor(initialSettings.primary_color || '#2563eb');
      setH1Color(initialSettings.h1_color || '#0F172A');
      setH2Color(initialSettings.h2_color || '#0F172A');
      setFontFamily(initialSettings.font_family || 'Inter, sans-serif');
      setHeaderLeft(initialSettings.header_left || '');
      setHeaderCenter(initialSettings.header_center || '');
      setHeaderRight(initialSettings.header_right || '');
      setPageNumbers(initialSettings.page_numbers ?? false);
      setPageNumberPosition(initialSettings.page_number_position || 'center');
      setPageNumberFormat(initialSettings.page_number_format || 'number');
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
    if (logoHeight) params.set('logo_height', logoHeight);
    if (headerLeft) params.set('header_left', headerLeft);
    if (headerCenter) params.set('header_center', headerCenter);
    if (headerRight) params.set('header_right', headerRight);
    if (pageNumbers) params.set('page_numbers', 'true');
    if (pageNumberPosition) params.set('page_number_position', pageNumberPosition);
    if (pageNumberFormat) params.set('page_number_format', pageNumberFormat);
    if (paperSize) params.set('paper_size', paperSize);
    if (margins) params.set('margins', margins);
    return params;
  }, [selected, primaryColor, h1Color, h2Color, fontFamily, logoUrl, logoPosition, logoHeight, headerLeft, headerCenter, headerRight, pageNumbers, pageNumberPosition, pageNumberFormat, paperSize, margins]);

  const loadPreview = useCallback(async () => {
    setPreviewStatus('loading');
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const params = buildParams();
      params.set('format', 'html');
      const exportPath = documentId
        ? `/projects/${projectId}/documents/${documentId}/export`
        : `/projects/${projectId}/export`;
      const res = await fetch(`${baseURL}${exportPath}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      setPreviewHtml(html);
      setPreviewStatus('done');
    } catch {
      setPreviewStatus('error');
    }
  }, [buildParams, documentId, projectId]);

  useEffect(() => {
    if (!open) return;
    if (isPreviewable) {
      initialLoadDone.current = false;
      loadPreview().then(() => { initialLoadDone.current = true; });
    }
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
      initialLoadDone.current = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isPreviewable || !initialLoadDone.current) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(loadPreview, 600);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [primaryColor, h1Color, h2Color, fontFamily, logoUrl, logoPosition, logoHeight, headerLeft, headerCenter, headerRight, pageNumbers, pageNumberPosition, pageNumberFormat, paperSize, margins, selected]);

  const handleRetryPreview = () => { loadPreview(); };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(projectId, {
        export_settings: {
          logo_url: logoUrl || null,
          logo_position: logoPosition,
          logo_height: logoHeight,
          primary_color: primaryColor,
          h1_color: h1Color,
          h2_color: h2Color,
          font_family: fontFamily,
          header_left: headerLeft || undefined,
          header_center: headerCenter || undefined,
          header_right: headerRight || undefined,
          page_numbers: pageNumbers,
          page_number_position: pageNumberPosition,
          page_number_format: pageNumberFormat,
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
        a.download = `${safeName}.${FORMAT_OPTIONS.find(f => f.id === selected)!.ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      toast.success(batchMode ? 'Batch export complete' : `Exported as ${FORMAT_OPTIONS.find(f => f.id === selected)!.label}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 flex w-full max-w-6xl max-h-[94vh] min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* ── Settings Panel (≈30%) ── */}
        <div className="w-[340px] shrink-0 overflow-y-auto border-r border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Export</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{projectName}</p>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Format ── */}
          <CollapsibleGroup title="Format" icon={FileText} defaultOpen={true}>
            <div className="space-y-1.5">
              {FORMAT_OPTIONS.map((fmt) => {
                const Icon = fmt.icon;
                const isSel = selected === fmt.id;
                return (
                  <button key={fmt.id} onClick={() => setSelected(fmt.id)}
                    className={cn('w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                      isSel ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent/50')}
                  >
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                      isSel ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium', isSel ? 'text-primary' : 'text-foreground')}>{fmt.label}</span>
                      <span className={cn('ml-2 rounded px-1.5 py-0.5 text-[10px] font-mono',
                        isSel ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>.{fmt.ext}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleGroup>

          {isPreviewable && (
            <>
              {/* ── Branding ── */}
              <CollapsibleGroup title="Branding" icon={Palette} defaultOpen={false}>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Primary', val: primaryColor, set: setPrimaryColor },
                    { label: 'H1', val: h1Color, set: setH1Color },
                    { label: 'H2', val: h2Color, set: setH2Color },
                  ].map((c) => (
                    <div key={c.label}>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">{c.label}</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={c.val} onChange={(e) => c.set(e.target.value)}
                          className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent p-0 shrink-0" />
                        <input type="text" value={c.val} onChange={(e) => c.set(e.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-1 text-[10px] font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1"><FileType className="mr-1 inline h-2.5 w-2.5" />Font</label>
                  <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" style={{ fontFamily }}>
                    {FONTS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </CollapsibleGroup>

              {/* ── Logo ── */}
              <CollapsibleGroup title="Logo" icon={Image} defaultOpen={false}>
                <LogoUploader value={logoUrl} onChange={setLogoUrl} />
                {logoUrl && (
                  <>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Position</label>
                      <select value={logoPosition} onChange={(e) => setLogoPosition(e.target.value as typeof logoPosition)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        {LOGO_POSITIONS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Size: {logoHeight}</label>
                      <div className="flex gap-1">
                        {LOGO_HEIGHTS.map((h) => (
                          <button key={h.value} onClick={() => setLogoHeight(h.value)}
                            className={cn('flex-1 rounded px-1 py-1 text-[10px] font-medium transition-colors',
                              logoHeight === h.value ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground hover:bg-accent')}
                          >{h.label}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CollapsibleGroup>

              {/* ── Header & Footer ── */}
              <CollapsibleGroup title="Header & Footer" icon={BookOpen} defaultOpen={false}>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">Header text</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { icon: AlignLeft, val: headerLeft, set: setHeaderLeft, place: 'Left' },
                      { icon: AlignCenter, val: headerCenter, set: setHeaderCenter, place: 'Centre' },
                      { icon: AlignRight, val: headerRight, set: setHeaderRight, place: 'Right' },
                    ].map((h) => (
                      <div key={h.place} className="flex items-center gap-1">
                        <h.icon className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <input type="text" value={h.val} onChange={(e) => h.set(e.target.value)}
                          placeholder={h.place} className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[11px]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-muted-foreground">Page numbers</label>
                  <button onClick={() => setPageNumbers(!pageNumbers)}
                    className={cn('relative h-4 w-8 rounded-full transition-colors', pageNumbers ? 'bg-primary' : 'bg-border')}>
                    <span className={cn('absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform', pageNumbers && 'translate-x-4')} />
                  </button>
                </div>
                {pageNumbers && (
                  <>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Page number position</label>
                      <div className="flex gap-1">
                        {['left', 'center', 'right'].map((pos) => (
                          <button key={pos} onClick={() => setPageNumberPosition(pos as typeof pageNumberPosition)}
                            className={cn('flex-1 rounded px-2 py-1 text-[10px] font-medium capitalize transition-colors',
                              pageNumberPosition === pos ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground hover:bg-accent')}
                          >{pos}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-muted-foreground">Show "Page" prefix</label>
                      <button onClick={() => setPageNumberFormat(pageNumberFormat === 'page-n' ? 'number' : 'page-n')}
                        className={cn('relative h-4 w-8 rounded-full transition-colors', pageNumberFormat === 'page-n' ? 'bg-primary' : 'bg-border')}>
                        <span className={cn('absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform', pageNumberFormat === 'page-n' && 'translate-x-4')} />
                      </button>
                    </div>
                  </>
                )}
              </CollapsibleGroup>

              {/* ── Page (PDF only) ── */}
              {selected === 'pdf' && (
                <CollapsibleGroup title="Page" icon={Ruler} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Paper size</label>
                      <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as typeof paperSize)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        {PAPER_SIZES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1">Margins</label>
                      <select value={margins} onChange={(e) => setMargins(e.target.value as typeof margins)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        {MARGIN_OPTIONS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                      </select>
                    </div>
                  </div>
                </CollapsibleGroup>
              )}
            </>
          )}

          {/* ── Save / Export Footer ── */}
          <div className="mt-4 space-y-2.5">
            <button onClick={handleSaveSettings} disabled={saving}
              className="w-full rounded-lg border border-border bg-background py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors">
              {saving ? 'Saving…' : 'Save as defaults'}
            </button>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Batch ZIP</span>
              </div>
              <button onClick={() => setBatchMode(!batchMode)}
                className={cn('relative h-4 w-8 rounded-full transition-colors', batchMode ? 'bg-primary' : 'bg-border')}>
                <span className={cn('absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform', batchMode && 'translate-x-4')} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="flex-1 rounded-lg border border-border bg-background py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={handleExport} disabled={loading}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
                  done ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  loading && 'opacity-70 cursor-not-allowed')}>
                {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting</>
                  : done ? <><CheckCircle2 className="h-3.5 w-3.5" /> Downloaded</>
                  : <><FileDown className="h-3.5 w-3.5" /> Export</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Preview Panel (≈70%) ── */}
        {isPreviewable ? (
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Eye className="h-3.5 w-3.5" />
                Live Preview
              </div>
              {previewStatus === 'error' && (
                <button onClick={handleRetryPreview} className="text-[10px] text-primary underline">Retry</button>
              )}
            </div>
            <div className="flex-1 bg-white">
              {previewStatus === 'loading' && !previewHtml ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : previewStatus === 'error' ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <span>Preview failed to load</span>
                  <button onClick={handleRetryPreview} className="text-primary underline">Retry</button>
                </div>
              ) : previewHtml ? (
                <iframe srcDoc={previewHtml} className="h-full w-full border-0" title="Export preview" sandbox="allow-same-origin" />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Select HTML or PDF to see a live preview
          </div>
        )}
      </div>
    </div>
  );
};
