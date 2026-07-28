import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const frontendRoot = process.cwd();

const rawProductColorPattern =
  /(?:className\s*=\s*["'][^"']*(?:bg|text|border|ring|from|to|via)-(?:red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)-\d{2,3}[^"']*["'])|#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl|oklch)\(/;
const arbitraryVisualPattern =
  /\b(?:bg|text|border|ring|shadow|rounded|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h|inset|top|right|bottom|left|translate-x|translate-y)-\[[^\]]+\]/;
const arbitraryRadiusOrShadowPattern =
  /\b(?:rounded|shadow)-\[[^\]]+\]|\bshadow-(?!overlay\b)[a-z0-9-]+\b/;
const repeatedLocalStylingPattern =
  /\b(?:rounded-(?:sm|md|lg|xl|2xl|3xl|full)|shadow-(?:sm|md|lg|xl|2xl)|bg-(?:panel|card|muted|background|workspace|canvas)|border\s+border-border)\b/g;
const inlineStylePattern = /style=\{\{([^}]*)\}\}/gs;

const allowedRawColorFiles = new Set([
  'src/index.css',
]);
const legacyVisualDebtFiles = new Set([
  'src/components/editor/MiddlePanel.tsx',
  'src/pages/DocumentEditorPage.tsx',
  'src/components/editor/QualityModal.tsx',
]);
const governedPrimitiveDirectories = [
  'src/components/ui/',
];

function fail(message) {
  console.error(`[design-system] ${message}`);
  process.exitCode = 1;
}

function gitChangedFiles() {
  try {
    const output = execSync(
      'git diff --name-only HEAD -- frontend/src frontend/tailwind.config.cjs frontend/eslint.config.js',
      { cwd: repoRoot, encoding: 'utf8' }
    );
    return output
      .split('\n')
      .filter(Boolean)
      .map((file) => file.replace(/^frontend\//, ''));
  } catch {
    return [];
  }
}

function isGovernedPrimitive(file) {
  return governedPrimitiveDirectories.some((directory) => file.startsWith(directory));
}

function checkedFiles() {
  const changed = gitChangedFiles().filter((file) => /\.(tsx?|css|cjs|mjs)$/.test(file));
  if (changed.length > 0) return changed;
  return [
    'src/components/ui/badge.tsx',
    'src/components/ui/button.tsx',
    'src/components/ui/dialog.tsx',
    'src/components/ui/empty-state.tsx',
    'src/components/ui/input.tsx',
    'src/components/ui/notice.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/progress.tsx',
    'src/components/ui/select.tsx',
    'src/components/ui/segmented-control.tsx',
    'src/components/ui/surface.tsx',
    'src/components/ui/tabs.tsx',
    'src/components/ui/tooltip.tsx',
  ];
}

function assertRawColorDetectorWorks() {
  const bad = '<div className="bg-[#123456] text-red-500" style={{ color: "#fff" }} />';
  if (!rawProductColorPattern.test(bad) && !arbitraryVisualPattern.test(bad)) {
    fail('raw product UI color detector did not catch the fixture hardcoded color');
  }
}

function assertArbitraryVisualDetectorWorks() {
  const bad = '<div className="rounded-[13px] shadow-[0_8px_30px_rgb(0_0_0/0.2)] max-w-[41rem]" />';
  if (!arbitraryVisualPattern.test(bad) || !arbitraryRadiusOrShadowPattern.test(bad)) {
    fail('arbitrary visual detector did not catch the fixture radius, shadow, or sizing value');
  }
}

function assertLocalStylingDetectorWorks() {
  const bad = '<div className="rounded-lg border border-border bg-panel p-4 shadow-sm" />';
  const matches = bad.match(repeatedLocalStylingPattern) || [];
  if (matches.length < 3) {
    fail('local styling detector did not catch the fixture repeated panel treatment');
  }
}

function isAllowedInlineStyle(file, styleBody) {
  const normalized = styleBody.replace(/\s+/g, ' ');
  if (/width:\s*`?\$\{[^}]+}%`?/.test(normalized)) {
    return true;
  }
  if (
    file.includes('/editor/') &&
    /\b(?:top|left|right|bottom|width|height|transform):/.test(normalized)
  ) {
    return true;
  }
  if (
    file.includes('Export') &&
    /\b(?:color|backgroundColor|borderColor|fontFamily):/.test(normalized) &&
    /\b(?:primaryColor|fontFamily|branding|export)/i.test(normalized)
  ) {
    return true;
  }
  if (
    /\b(?:background|backgroundImage|backgroundSize):/.test(normalized) &&
    /var\(--interaction\)|color-mix\(/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function assertInlineStyleDetectorWorks() {
  const bad = '<div style={{ color: "#123456", borderRadius: "12px" }} />';
  const allowedProgress = '<div style={{ width: `${percentage}%` }} />';
  const allowedEditor = '<div style={{ top: position.top, left: position.left }} />';
  const allowedExport = '<div style={{ color: primaryColor, fontFamily }} />';
  if (!inlineStylePattern.test(bad)) {
    fail('inline style detector did not catch the fixture inline style');
  }
  inlineStylePattern.lastIndex = 0;
  if (
    !isAllowedInlineStyle('src/components/ui/progress.tsx', ' width: `${percentage}%` ') ||
    !isAllowedInlineStyle('src/components/editor/BubbleMenu.tsx', ' top: position.top, left: position.left ') ||
    !isAllowedInlineStyle('src/components/editor/ExportModal.tsx', ' color: primaryColor, fontFamily ')
  ) {
    fail('inline style detector rejected an allowed runtime-computed fixture');
  }
  inlineStylePattern.lastIndex = 0;
  if (isAllowedInlineStyle('src/pages/HomePage.tsx', ' color: "#123456", borderRadius: "12px" ')) {
    fail('inline style detector allowed a hardcoded product UI style fixture');
  }
  void allowedProgress;
  void allowedEditor;
  void allowedExport;
}

function assertNoRawVisualsInChangedFiles() {
  for (const file of checkedFiles()) {
    const absolute = path.join(frontendRoot, file);
    if (!existsSync(absolute)) continue;
    if (legacyVisualDebtFiles.has(file)) continue;
    const source = readFileSync(absolute, 'utf8');
    if (!allowedRawColorFiles.has(file) && rawProductColorPattern.test(source)) {
      fail(`${file} contains raw product UI color; use semantic tokens or governed variants`);
    }
    if (!isGovernedPrimitive(file) && arbitraryVisualPattern.test(source)) {
      fail(`${file} contains arbitrary visual Tailwind values outside governed primitives`);
    }
    if (!isGovernedPrimitive(file) && arbitraryRadiusOrShadowPattern.test(source)) {
      fail(`${file} contains arbitrary radius or shadow outside governed primitives`);
    }
    if (!isGovernedPrimitive(file)) {
      const matches = source.match(repeatedLocalStylingPattern) || [];
      if (matches.length >= 3) {
        fail(`${file} repeats local panel/card styling; compose governed variants instead`);
      }
    }
    for (const match of source.matchAll(inlineStylePattern)) {
      if (!isAllowedInlineStyle(file, match[1])) {
        fail(`${file} contains inline product styling outside the runtime-computed exceptions`);
      }
    }
  }
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3
    ? value.split('').map((char) => `${char}${char}`).join('')
    : value.slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]) {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const first = luminance(hexToRgb(foreground));
  const second = luminance(hexToRgb(background));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVars() {
  const css = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
  const vars = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[match[1]] = match[2];
  }
  return vars;
}

function assertContrast() {
  const vars = cssVars();
  const pairs = [
    ['text-primary', 'canvas'],
    ['text-secondary', 'canvas'],
    ['sidebar-foreground', 'sidebar'],
    ['interaction-foreground', 'interaction'],
    ['status-success-foreground', 'status-success'],
    ['status-warning-foreground', 'status-warning'],
    ['status-danger-foreground', 'status-danger'],
    ['status-info-foreground', 'status-info'],
    ['status-generation-foreground', 'status-generation'],
    ['status-review-foreground', 'status-review'],
    ['status-needs-input-foreground', 'status-needs-input'],
  ];
  for (const [foreground, background] of pairs) {
    const ratio = contrast(vars[foreground], vars[background]);
    if (ratio < 4.5) {
      fail(`${foreground} on ${background} contrast is ${ratio.toFixed(2)}, below WCAG AA`);
    }
  }
}

function assertFocusHooks() {
  const focusFiles = [
    'src/components/ui/button.tsx',
    'src/components/ui/dialog.tsx',
    'src/components/ui/input.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/segmented-control.tsx',
    'src/components/ui/tabs.tsx',
  ];
  for (const file of focusFiles) {
    const source = readFileSync(path.join(frontendRoot, file), 'utf8');
    if (!source.includes('focus-visible')) {
      fail(`${file} does not expose a visible keyboard focus style`);
    }
  }
}

function assertReducedMotionCoverage() {
  const css = readFileSync(path.join(frontendRoot, 'src/index.css'), 'utf8');
  for (const marker of [
    '@media (prefers-reduced-motion: reduce)',
    'animation-duration: 0.01ms !important',
    'transition-duration: 0.01ms !important',
  ]) {
    if (!css.includes(marker)) {
      fail(`reduced motion coverage is missing ${marker}`);
    }
  }
}

function assertPrimitiveProofUsesVariants() {
  const source = readFileSync(
    path.join(frontendRoot, 'src/components/ui/design-system-proof.tsx'),
    'utf8'
  );
  const required = [
    '<Button',
    '<Badge',
    '<Notice',
    '<Surface',
    '<Input',
    '<Select',
    '<SegmentedControl',
    '<Progress',
    '<EmptyState',
    '<Tooltip',
    '<Popover',
    '<Tabs',
  ];
  for (const marker of required) {
    if (!source.includes(marker)) {
      fail(`design-system proof does not render ${marker}`);
    }
  }
  if (/\b(?:bg|border|shadow|rounded)-/.test(source)) {
    fail('design-system proof uses local visual restyling instead of shared variants');
  }
  const requiredStatuses = [
    'Generated Draft',
    'Reviewed',
    'Potentially Stale',
    'Needs input',
    'Generating',
    'Failed',
  ];
  for (const label of requiredStatuses) {
    if (!source.includes(label)) {
      fail(`design-system proof does not show the "${label}" status label`);
    }
  }
}

function assertPhase4SurfacesUseGovernedPrimitives() {
  const files = [
    'src/pages/DocumentEditorPage.tsx',
    'src/pages/ProjectActivityPage.tsx',
    'src/pages/SettingsPage.tsx',
    'src/pages/Analysis.tsx',
    'src/components/dashboard/TemplatesView.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(frontendRoot, file), 'utf8');
    if (!source.includes('<Surface')) {
      fail(`${file} does not render through Surface primitives`);
    }
  }
  const editorSource = readFileSync(
    path.join(frontendRoot, 'src/pages/DocumentEditorPage.tsx'),
    'utf8'
  );
  if (!editorSource.includes('<SectionStatusBadge')) {
    fail('DocumentEditorPage does not use the governed section status badge');
  }
  const statusSource = readFileSync(
    path.join(frontendRoot, 'src/lib/section-state.ts'),
    'utf8'
  );
  for (const label of ['Generated Draft', 'Reviewed', 'Potentially Stale', 'Needs Input', 'Generating', 'Failed']) {
    if (!statusSource.includes(label)) {
      fail(`section-state.ts is missing the "${label}" non-color status label`);
    }
  }
}

assertRawColorDetectorWorks();
assertArbitraryVisualDetectorWorks();
assertLocalStylingDetectorWorks();
assertInlineStyleDetectorWorks();
assertNoRawVisualsInChangedFiles();
assertContrast();
assertFocusHooks();
assertReducedMotionCoverage();
assertPrimitiveProofUsesVariants();
assertPhase4SurfacesUseGovernedPrimitives();

if (!process.exitCode) {
  console.log('[design-system] checks passed');
}
