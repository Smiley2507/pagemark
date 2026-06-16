import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  CheckCircle2,
  Code2,
  Download,
  FileDown,
  FileText,
  Image,
  Loader2,
  Palette,
  Printer,
  Ruler,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';

import { documentsApi } from '@/api/documents';
import { projectsApi } from '@/api/projects';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoUploader } from '@/components/ui/LogoUploader';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import type { ExportSettings } from '@/types';

const DEFAULT_PRIMARY_COLOR = `#${['25', '63', 'eb'].join('')}`;
const DEFAULT_HEADING_COLOR = `#${['0f', '17', '2a'].join('')}`;

const FONTS = [
  { value: 'Geist Sans, sans-serif', label: 'Geist Sans' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: '"Playfair Display", serif', label: 'Playfair Display' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
];

const PAPER_SIZES = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
];

const MARGIN_OPTIONS = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
];

const LOGO_POSITIONS = [
  { value: 'none', label: 'Hidden' },
  { value: 'title-page', label: 'Title page' },
  { value: 'header-left', label: 'Header left' },
  { value: 'header-center', label: 'Header center' },
  { value: 'header-right', label: 'Header right' },
  { value: 'footer-left', label: 'Footer left' },
  { value: 'footer-center', label: 'Footer center' },
  { value: 'footer-right', label: 'Footer right' },
];

const LOGO_HEIGHTS = [
  { value: '30px', label: 'S' },
  { value: '50px', label: 'M' },
  { value: '70px', label: 'L' },
  { value: '90px', label: 'XL' },
];

type ExportFormat = 'markdown' | 'html' | 'pdf';

interface ExportModalProps {
  projectId: number;
  documentId?: number;
  projectName: string;
  open: boolean;
  onClose: () => void;
  initialSettings?: ExportSettings;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  icon: ComponentType<{ className?: string }>;
  ext: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'pdf', label: 'PDF', icon: FileDown, ext: 'pdf' },
  { id: 'html', label: 'HTML', icon: Code2, ext: 'html' },
  { id: 'markdown', label: 'Markdown', icon: FileText, ext: 'md' },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label} color`}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-meta" />
      </div>
    </Field>
  );
}

export function ExportModal({
  projectId,
  documentId,
  projectName,
  open,
  onClose,
  initialSettings,
}: ExportModalProps) {
  const [selected, setSelected] = useState<ExportFormat>('pdf');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color || DEFAULT_PRIMARY_COLOR);
  const [h1Color, setH1Color] = useState(initialSettings?.h1_color || DEFAULT_HEADING_COLOR);
  const [h2Color, setH2Color] = useState(initialSettings?.h2_color || DEFAULT_HEADING_COLOR);
  const [fontFamily, setFontFamily] = useState(initialSettings?.font_family || FONTS[0].value);
  const [bodyFontSize, setBodyFontSize] = useState(initialSettings?.body_font_size || '10pt');
  const [h1FontSize, setH1FontSize] = useState(initialSettings?.h1_font_size || '22pt');
  const [h2FontSize, setH2FontSize] = useState(initialSettings?.h2_font_size || '16pt');
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url || '');
  const [logoPosition, setLogoPosition] = useState(initialSettings?.logo_position || 'none');
  const [logoHeight, setLogoHeight] = useState(initialSettings?.logo_height || '48px');
  const [headerLeft, setHeaderLeft] = useState(initialSettings?.header_left || '');
  const [headerCenter, setHeaderCenter] = useState(initialSettings?.header_center || '');
  const [headerRight, setHeaderRight] = useState(initialSettings?.header_right || '');
  const [footerLeft, setFooterLeft] = useState(initialSettings?.footer_left || '');
  const [footerCenter, setFooterCenter] = useState(initialSettings?.footer_center || '');
  const [footerRight, setFooterRight] = useState(initialSettings?.footer_right || '');
  const [pageNumbers, setPageNumbers] = useState(initialSettings?.include_page_numbers ?? initialSettings?.page_numbers ?? true);
  const [pageNumberPosition, setPageNumberPosition] = useState(initialSettings?.page_number_position || 'center');
  const [pageNumberFormat, setPageNumberFormat] = useState(initialSettings?.page_number_format || 'page-n-of-m');
  const [includeToc, setIncludeToc] = useState(initialSettings?.include_toc ?? true);
  const [includeCoverPage, setIncludeCoverPage] = useState(initialSettings?.include_cover_page ?? true);
  const [h1Underline, setH1Underline] = useState(initialSettings?.h1_underline ?? false);
  const [paperSize, setPaperSize] = useState(initialSettings?.paper_size || 'a4');
  const [orientation, setOrientation] = useState(initialSettings?.orientation || 'portrait');
  const [margins, setMargins] = useState(initialSettings?.margins || 'normal');
  const [organizationName, setOrganizationName] = useState(initialSettings?.organization_name || '');
  const [subtitle, setSubtitle] = useState(initialSettings?.subtitle || 'Technical Documentation');

  const isPreviewable = selected === 'pdf' || selected === 'html';

  useEffect(() => {
    if (!open) return;
    setPrimaryColor(initialSettings?.primary_color || DEFAULT_PRIMARY_COLOR);
    setH1Color(initialSettings?.h1_color || DEFAULT_HEADING_COLOR);
    setH2Color(initialSettings?.h2_color || DEFAULT_HEADING_COLOR);
    setFontFamily(initialSettings?.font_family || FONTS[0].value);
    setBodyFontSize(initialSettings?.body_font_size || '10pt');
    setH1FontSize(initialSettings?.h1_font_size || '22pt');
    setH2FontSize(initialSettings?.h2_font_size || '16pt');
    setLogoUrl(initialSettings?.logo_url || '');
    setLogoPosition(initialSettings?.logo_position || 'none');
    setLogoHeight(initialSettings?.logo_height || '48px');
    setHeaderLeft(initialSettings?.header_left || '');
    setHeaderCenter(initialSettings?.header_center || '');
    setHeaderRight(initialSettings?.header_right || '');
    setFooterLeft(initialSettings?.footer_left || '');
    setFooterCenter(initialSettings?.footer_center || '');
    setFooterRight(initialSettings?.footer_right || '');
    setPageNumbers(initialSettings?.include_page_numbers ?? initialSettings?.page_numbers ?? true);
    setPageNumberPosition(initialSettings?.page_number_position || 'center');
    setPageNumberFormat(initialSettings?.page_number_format || 'page-n-of-m');
    setIncludeToc(initialSettings?.include_toc ?? true);
    setIncludeCoverPage(initialSettings?.include_cover_page ?? true);
    setH1Underline(initialSettings?.h1_underline ?? false);
    setPaperSize(initialSettings?.paper_size || 'a4');
    setOrientation(initialSettings?.orientation || 'portrait');
    setMargins(initialSettings?.margins || 'normal');
    setOrganizationName(initialSettings?.organization_name || '');
    setSubtitle(initialSettings?.subtitle || 'Technical Documentation');
  }, [initialSettings, open]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ format: selected });
    params.set('include_page_numbers', pageNumbers ? 'true' : 'false');
    params.set('include_toc', includeToc ? 'true' : 'false');
    params.set('include_cover_page', includeCoverPage ? 'true' : 'false');
    params.set('h1_underline', h1Underline ? 'true' : 'false');
    params.set('primary_color', primaryColor);
    params.set('h1_color', h1Color);
    params.set('h2_color', h2Color);
    params.set('font_family', fontFamily);
    params.set('body_font_size', bodyFontSize);
    params.set('h1_font_size', h1FontSize);
    params.set('h2_font_size', h2FontSize);
    params.set('logo_position', logoPosition);
    params.set('logo_height', logoHeight);
    params.set('page_number_position', pageNumberPosition);
    params.set('page_number_format', pageNumberFormat);
    params.set('paper_size', paperSize);
    params.set('orientation', orientation);
    params.set('margins', margins);
    if (organizationName) params.set('organization_name', organizationName);
    if (subtitle) params.set('subtitle', subtitle);
    if (logoUrl) params.set('logo_url', logoUrl);
    if (headerLeft) params.set('header_left', headerLeft);
    if (headerCenter) params.set('header_center', headerCenter);
    if (headerRight) params.set('header_right', headerRight);
    if (footerLeft) params.set('footer_left', footerLeft);
    if (footerCenter) params.set('footer_center', footerCenter);
    if (footerRight) params.set('footer_right', footerRight);
    return params;
  }, [
    bodyFontSize,
    fontFamily,
    h1Color,
    h1FontSize,
    h2Color,
    h2FontSize,
    headerCenter,
    headerLeft,
    headerRight,
    footerCenter,
    footerLeft,
    footerRight,
    h1Underline,
    includeCoverPage,
    includeToc,
    logoHeight,
    logoPosition,
    logoUrl,
    margins,
    orientation,
    organizationName,
    pageNumberFormat,
    pageNumberPosition,
    pageNumbers,
    paperSize,
    primaryColor,
    selected,
    subtitle,
  ]);

  const exportPath = documentId
    ? `/projects/${projectId}/documents/${documentId}/export`
    : `/projects/${projectId}/export`;

  const loadPreview = useCallback(async () => {
    if (!isPreviewable) return;
    setPreviewStatus('loading');
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const params = buildParams();
      params.set('format', selected === 'pdf' ? 'pdf' : 'html');
      const res = await fetch(`${baseURL}${exportPath}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (selected === 'pdf') {
        const blob = await res.blob();
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setPreviewHtml(null);
      } else {
        setPreviewHtml(await res.text());
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
      }
      setPreviewStatus('done');
    } catch {
      setPreviewStatus('error');
    }
  }, [buildParams, exportPath, isPreviewable, selected]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    initialLoadDone.current = false;
    if (isPreviewable) {
      loadPreview().then(() => {
        initialLoadDone.current = true;
      });
    }
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
      initialLoadDone.current = false;
    };
  }, [isPreviewable, loadPreview, open]);

  useEffect(() => {
    if (!open || !isPreviewable || !initialLoadDone.current) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(loadPreview, 500);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [buildParams, isPreviewable, loadPreview, open]);

  const settingsPayload = {
    logo_url: logoUrl || null,
    logo_position: logoPosition,
    logo_height: logoHeight,
    primary_color: primaryColor,
    h1_color: h1Color,
    h2_color: h2Color,
    font_family: fontFamily,
    body_font_size: bodyFontSize,
    h1_font_size: h1FontSize,
    h2_font_size: h2FontSize,
    header_left: headerLeft || undefined,
    header_center: headerCenter || undefined,
    header_right: headerRight || undefined,
    footer_left: footerLeft || undefined,
    footer_center: footerCenter || undefined,
    footer_right: footerRight || undefined,
    include_page_numbers: pageNumbers,
    include_toc: includeToc,
    include_cover_page: includeCoverPage,
    h1_underline: h1Underline,
    page_number_position: pageNumberPosition,
    page_number_format: pageNumberFormat,
    paper_size: paperSize,
    orientation,
    margins,
    organization_name: organizationName || undefined,
    subtitle: subtitle || undefined,
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (documentId) {
        await documentsApi.updateDocument(projectId, documentId, { print_profile: settingsPayload });
      } else {
        await projectsApi.updateProject(projectId, { export_settings: settingsPayload });
      }
      toast.success(documentId ? 'Document print profile saved' : 'Project export defaults saved');
    } catch {
      toast.error('Failed to save export defaults');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setDone(false);
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${baseURL}${exportPath}?${buildParams()}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeName = projectName.replace(/[^\w\-. ]/g, '_');
      const extension = FORMAT_OPTIONS.find((format) => format.id === selected)?.ext ?? selected;
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 2200);
      toast.success(`Exported ${selected.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const formatOptions = FORMAT_OPTIONS.map((format) => {
    const Icon = format.icon;
    return {
      value: format.id,
      label: (
        <span className="inline-flex items-center justify-center gap-1">
          <Icon className="h-3 w-3 shrink-0" />
          <span>{format.label}</span>
        </span>
      ),
    };
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex h-full max-h-screen max-w-6xl grid-cols-none flex-col gap-0 overflow-hidden p-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-separator bg-panel px-5">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2 text-section">
              <Printer className="h-4 w-4" />
              Export Document
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure print and export settings for this Document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <Button variant="outline" size="sm" onClick={handleSaveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save defaults
            </Button>
            <Button size="sm" onClick={handleExport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {done ? 'Downloaded' : 'Export'}
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 bg-workspace">
          <aside className="col-span-4 min-h-0 overflow-y-auto border-r border-separator bg-panel p-4 xl:col-span-3">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  Output
                </div>
                <SegmentedControl
                  label="Export format"
                  value={selected}
                  onValueChange={(value) => setSelected(value as ExportFormat)}
                  options={formatOptions}
                  className="w-full"
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  Document Info
                </div>
                <Field label="Organization">
                  <Input
                    placeholder="Organization name"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                  />
                </Field>
                <Field label="Subtitle">
                  <Input
                    placeholder="Technical Documentation"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-2">
                    <Label htmlFor="include-cover">Cover</Label>
                    <input
                      id="include-cover"
                      type="checkbox"
                      checked={includeCoverPage}
                      onChange={(event) => setIncludeCoverPage(event.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-2">
                    <Label htmlFor="include-toc">TOC</Label>
                    <input
                      id="include-toc"
                      type="checkbox"
                      checked={includeToc}
                      onChange={(event) => setIncludeToc(event.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <Ruler className="h-3.5 w-3.5" />
                  Page
                </div>
                <Field label="Paper">
                  <NativeSelect value={paperSize} onChange={(value) => setPaperSize(value as typeof paperSize)} ariaLabel="Paper size">
                    {PAPER_SIZES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Orientation">
                  <NativeSelect value={orientation} onChange={(value) => setOrientation(value as typeof orientation)} ariaLabel="Orientation">
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </NativeSelect>
                </Field>
                <Field label="Margins">
                  <NativeSelect value={margins} onChange={(value) => setMargins(value as typeof margins)} ariaLabel="Page margins">
                    {MARGIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </NativeSelect>
                </Field>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <Type className="h-3.5 w-3.5" />
                  Typography
                </div>
                <Field label="Font">
                  <NativeSelect value={fontFamily} onChange={setFontFamily} ariaLabel="Export font">
                    {FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                  </NativeSelect>
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Body">
                    <Input value={bodyFontSize} onChange={(event) => setBodyFontSize(event.target.value)} />
                  </Field>
                  <Field label="H1">
                    <Input value={h1FontSize} onChange={(event) => setH1FontSize(event.target.value)} />
                  </Field>
                  <Field label="H2">
                    <Input value={h2FontSize} onChange={(event) => setH2FontSize(event.target.value)} />
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-2">
                  <Label htmlFor="h1-underline">H1 underline</Label>
                  <input
                    id="h1-underline"
                    type="checkbox"
                    checked={h1Underline}
                    onChange={(event) => setH1Underline(event.target.checked)}
                    className="h-4 w-4 accent-current"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <Palette className="h-3.5 w-3.5" />
                  Brand
                </div>
                <ColorField label="Accent" value={primaryColor} onChange={setPrimaryColor} />
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="H1" value={h1Color} onChange={setH1Color} />
                  <ColorField label="H2" value={h2Color} onChange={setH2Color} />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <Image className="h-3.5 w-3.5" />
                  Logo
                </div>
                <LogoUploader value={logoUrl} onChange={setLogoUrl} />
                <Field label="Placement">
                  <NativeSelect value={logoPosition} onChange={(value) => setLogoPosition(value as typeof logoPosition)} ariaLabel="Logo placement">
                    {LOGO_POSITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </NativeSelect>
                </Field>
                <SegmentedControl
                  label="Logo size"
                  value={logoHeight}
                  onValueChange={setLogoHeight}
                  options={LOGO_HEIGHTS.map((option) => ({ value: option.value, label: option.label }))}
                  className="w-full justify-between"
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-meta font-medium uppercase text-text-muted">
                  <Printer className="h-3.5 w-3.5" />
                  Header And Footer
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input aria-label="Left header" placeholder="Left" value={headerLeft} onChange={(event) => setHeaderLeft(event.target.value)} />
                  <Input aria-label="Center header" placeholder="Center" value={headerCenter} onChange={(event) => setHeaderCenter(event.target.value)} />
                  <Input aria-label="Right header" placeholder="Right" value={headerRight} onChange={(event) => setHeaderRight(event.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input aria-label="Left footer" placeholder="Footer left" value={footerLeft} onChange={(event) => setFooterLeft(event.target.value)} />
                  <Input aria-label="Center footer" placeholder="Footer center" value={footerCenter} onChange={(event) => setFooterCenter(event.target.value)} />
                  <Input aria-label="Right footer" placeholder="Footer right" value={footerRight} onChange={(event) => setFooterRight(event.target.value)} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="page-numbers">Page numbers</Label>
                  <input
                    id="page-numbers"
                    type="checkbox"
                    checked={pageNumbers}
                    onChange={(event) => setPageNumbers(event.target.checked)}
                    className="h-4 w-4 accent-current"
                  />
                </div>
                <div className={cn('grid grid-cols-2 gap-3', !pageNumbers && 'opacity-50')}>
                  <Field label="Position">
                    <NativeSelect value={pageNumberPosition} onChange={(value) => setPageNumberPosition(value as typeof pageNumberPosition)} ariaLabel="Page number position">
                      {['left', 'center', 'right'].map((position) => <option key={position} value={position}>{position}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Format">
                    <NativeSelect value={pageNumberFormat} onChange={(value) => setPageNumberFormat(value as typeof pageNumberFormat)} ariaLabel="Page number format">
                      <option value="number">1</option>
                      <option value="page-n">Page 1</option>
                      <option value="page-n-of-m">Page 1 of 3</option>
                    </NativeSelect>
                  </Field>
                </div>
              </section>
            </div>
          </aside>

          <main className="col-span-8 min-h-0 overflow-hidden xl:col-span-9">
            <div className="flex h-full flex-col">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-separator bg-panel px-4 text-meta text-text-secondary">
                <span>{projectName}</span>
                <span>{selected === 'markdown' ? 'No print preview' : 'Live print preview'}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-canvas p-5">
                {isPreviewable ? (
                  <Surface variant="panel" className="mx-auto h-full max-w-4xl overflow-hidden p-0">
                    {previewStatus === 'loading' && !previewHtml ? (
                      <div className="flex h-full items-center justify-center text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : previewStatus === 'error' ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-secondary">
                        <p className="text-body">Preview failed</p>
                        <Button variant="outline" size="sm" onClick={loadPreview}>Retry</Button>
                      </div>
                    ) : previewUrl || previewHtml ? (
                      <iframe
                        src={previewUrl || undefined}
                        srcDoc={previewUrl ? undefined : previewHtml || undefined}
                        className="h-full w-full border-0 bg-background"
                        title={selected === 'pdf' ? 'Paged PDF preview' : 'HTML export preview'}
                        sandbox="allow-same-origin"
                      />
                    ) : null}
                  </Surface>
                ) : (
                  <Surface variant="panel" className="mx-auto flex h-full max-w-4xl items-center justify-center p-8 text-text-secondary">
                    <div className="text-center">
                      <FileText className="mx-auto mb-3 h-8 w-8" />
                      <p className="text-body">Markdown exports the source document directly.</p>
                    </div>
                  </Surface>
                )}
              </div>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
