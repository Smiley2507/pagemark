import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Image, Type, Palette, Layout as LayoutIcon,
  FileType, BookOpen, Ruler, Loader2, Eye,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectsApi } from '@/api/projects';
import { cn } from '@/lib/utils';
import { LogoUploader } from '@/components/ui/LogoUploader';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import type { Project, ExportSettings } from '@/types';

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (default)' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
];

const LOGO_POSITIONS = [
  { value: 'title-page', label: 'Title page only' },
  { value: 'header-left', label: 'Header left' },
  { value: 'header-center', label: 'Header center' },
  { value: 'header-right', label: 'Header right' },
  { value: 'none', label: 'None' },
];

const VISUAL_KEYS = new Set(['h1_color', 'h2_color', 'primary_color', 'font_family', 'logo_url']);

function resolveHexColorVar(variableName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return /^([\x23][0-9a-fA-F]{6})$/.test(value) ? value : fallback;
}

function useProject(projectId: number) {
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  });
}

function structuralKey(s: ExportSettings): string {
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s))
    if (!VISUAL_KEYS.has(k)) rest[k] = v;
  return JSON.stringify(rest);
}

function visualCSS(s: ExportSettings): string {
  return [
    s.h1_color && `--h1-color:${s.h1_color}`,
    s.h2_color && `--h2-color:${s.h2_color}`,
    s.primary_color && `--primary-color:${s.primary_color}`,
    s.font_family && `--font-family:${s.font_family}`,
    s.logo_url && `--logo-url:url(${s.logo_url})`,
  ].filter(Boolean).join(';');
}

export function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const navigate = useNavigate();

  const { data: project } = useProject(pid);
  const savedSettings = project?.export_settings;

  const [settings, setSettings] = useState<ExportSettings>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'pdf'>('html');
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevSk = useRef('');

  const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  const defaultHeadingColor = resolveHexColorVar('--text-primary', 'black');
  const defaultAccentColor = resolveHexColorVar('--interaction', 'navy');

  useEffect(() => {
    if (savedSettings) setSettings((s) => ({ ...s, ...savedSettings }));
  }, [savedSettings]);

  const updateSetting = useCallback(<K extends keyof ExportSettings>(
    key: K, value: ExportSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Initial fetch — runs once on mount
  useEffect(() => {
    if (!pid) return;
    setPreviewLoading(true);
    const params = new URLSearchParams({ format: 'html' });
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && val !== null && val !== '')
        params.set(key, String(val));
    }
    fetch(`${baseURL}/projects/${pid}/export?${params}`, { credentials: 'include' })
      .then((r) => r.text())
      .then(setPreviewHtml)
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  }, [pid]);

  // Re-fetch on structural changes; inject CSS on visual-only changes
  useEffect(() => {
    if (!pid) return;
    const sk = structuralKey(settings);
    if (sk === prevSk.current && previewHtml) {
      const ifr = iframeRef.current;
      try {
        const doc = ifr?.contentDocument ?? ifr?.contentWindow?.document;
        if (doc) {
          let style = doc.getElementById('pm-export-style') as HTMLStyleElement | null;
          if (!style) {
            style = doc.createElement('style');
            style.id = 'pm-export-style';
            doc.head.appendChild(style);
          }
          style.textContent = `:root{${visualCSS(settings)}}`;
          return;
        }
      } catch { /* fall through to re-fetch */ }
    } else {
      prevSk.current = sk;
    }
    if (!previewHtml) return;
    setPreviewLoading(true);
    const params = new URLSearchParams({ format: 'html' });
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && val !== null && val !== '')
        params.set(key, String(val));
    }
    fetch(`${baseURL}/projects/${pid}/export?${params}`, { credentials: 'include' })
      .then((r) => r.text())
      .then(setPreviewHtml)
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  }, [pid, settings, previewHtml, baseURL]);

  // Auto-save with debounce
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await projectsApi.updateProject(pid, { export_settings: settings });
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [pid, settings]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: exportFormat });
      for (const [key, val] of Object.entries(settings)) {
        if (val !== undefined && val !== null && val !== '')
          params.set(key, String(val));
      }
      const res = await fetch(`${baseURL}/projects/${pid}/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project?.name ?? 'documentation').replace(/[^\w\-. ]/g, '_')}.${exportFormat === 'html' ? 'html' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-workspace">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator bg-panel px-4">
        <Link to={`/editor/${pid}`} className="flex items-center gap-1.5 text-meta text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Link>
        <span className="text-muted-foreground/30">|</span>
        <h1 className="text-section font-semibold truncate">{project?.name ?? 'Loading\u2026'} \u2014 Export</h1>
        <div className="flex-1" />
        {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving\u2026</span>}
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as 'html' | 'pdf')}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="html">HTML</option>
          <option value="pdf">PDF</option>
        </select>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-separator bg-panel-muted p-5 space-y-6">
          <Notice variant="info" title="Document Export">
            Export applies to one Document at a time. Choose the format, branding, and page options before downloading.
          </Notice>
          {/* Branding */}
          <Surface variant="panel" padding="default" as="section">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Palette className="h-4 w-4" />
              Branding
            </h2>
            <div className="space-y-3">
              <ColorField label="Heading 1" value={settings.h1_color || defaultHeadingColor} onChange={(v) => updateSetting('h1_color', v)} />
              <ColorField label="Heading 2" value={settings.h2_color || defaultHeadingColor} onChange={(v) => updateSetting('h2_color', v)} />
              <ColorField label="Accent" value={settings.primary_color || defaultAccentColor} onChange={(v) => updateSetting('primary_color', v)} />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Font</label>
                <select value={settings.font_family || 'Inter, sans-serif'} onChange={(e) => updateSetting('font_family', e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                  {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1"><Image className="mr-1 inline h-3 w-3" />Logo</label>
                <LogoUploader value={settings.logo_url || ''} onChange={(v) => updateSetting('logo_url', v)} />
              </div>
              {settings.logo_url && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Logo position</label>
                  <select value={settings.logo_position || 'title-page'} onChange={(e) => updateSetting('logo_position', e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                    {LOGO_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </Surface>

          {/* Header / Footer */}
          <Surface variant="panel" padding="default" as="section">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <BookOpen className="h-4 w-4" />
              Header &amp; Footer
            </h2>
            <div className="space-y-3">
              <TextInput label="Header left" value={settings.header_left || ''} onChange={(v) => updateSetting('header_left', v)} />
              <TextInput label="Header center" value={settings.header_center || ''} onChange={(v) => updateSetting('header_center', v)} />
              <TextInput label="Header right" value={settings.header_right || ''} onChange={(v) => updateSetting('header_right', v)} />
              <ToggleField label="Page numbers" value={settings.page_numbers ?? false} onChange={(v) => updateSetting('page_numbers', v)} />
            </div>
          </Surface>

          {/* Layout */}
          <Surface variant="panel" padding="default" as="section">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Ruler className="h-4 w-4" />
              Layout
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Paper size</label>
                <select value={settings.paper_size || 'a4'} onChange={(e) => updateSetting('paper_size', e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Margins</label>
                <select value={settings.margins || 'normal'} onChange={(e) => updateSetting('margins', e.target.value as any)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                  <option value="normal">Normal</option>
                  <option value="narrow">Narrow</option>
                  <option value="wide">Wide</option>
                </select>
              </div>
            </div>
          </Surface>
        </aside>

        {/* Preview */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-separator bg-panel px-4 py-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            {previewLoading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex-1 overflow-auto bg-workspace p-4">
            {previewHtml ? (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                className="mx-auto h-full w-full max-w-[900px] rounded-lg border border-border bg-panel shadow-sm"
                title="Export preview"
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading preview\u2026
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Helpers

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent p-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono" />
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <button onClick={() => onChange(!value)} className={cn('relative h-5 w-9 rounded-full transition-colors', value ? 'bg-primary' : 'bg-border')}>
        <span className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-panel transition-transform', value && 'translate-x-4')} />
      </button>
    </div>
  );
}
