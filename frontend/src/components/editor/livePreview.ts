/**
 * livePreview.ts — Obsidian-parity Live Preview for CodeMirror 6
 */

import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';

// ─────────────────────────────────────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────────────────────────────────────

class WikiLinkWidget extends WidgetType {
  readonly text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  eq(o: WidgetType) { return o instanceof WikiLinkWidget && o.text === this.text; }

  toDOM(): HTMLElement {
    const link = document.createElement('a');
    link.className = 'cm-lp-wikilink';
    link.textContent = `[[${this.text}]]`;
    link.href = '#';
    link.onclick = (e) => { e.preventDefault(); };
    return link;
  }
  ignoreEvent() { return false; }
}

class CalloutWidget extends WidgetType {
  readonly type: string;
  readonly title: string;
  readonly content: string;

  constructor(type: string, title: string, content: string) {
    super();
    this.type = type.toLowerCase();
    this.title = title;
    this.content = content;
  }
  eq(o: WidgetType) {
    return o instanceof CalloutWidget && o.type === this.type && o.title === this.title && o.content === this.content;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `cm-lp-callout cm-lp-callout-${this.type}`;

    const header = document.createElement('div');
    header.className = 'cm-lp-callout-header';
    header.innerHTML = `<span class="cm-lp-callout-title">${this.title || this.type}</span>`;

    const body = document.createElement('div');
    body.className = 'cm-lp-callout-body';
    body.textContent = this.content;

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class HRWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-lp-hr';
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  ignoreEvent() { return true; }
}

class ImageWidget extends WidgetType {
  readonly src: string;
  readonly alt: string;
  readonly width: number | undefined;
  constructor(src: string, alt: string, width?: number) {
    super();
    this.src = src;
    this.alt = alt;
    this.width = width;
  }
  eq(o: WidgetType) { return o instanceof ImageWidget && o.src === this.src && o.alt === this.alt && o.width === this.width; }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-lp-img-wrap';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'cm-lp-img';
    if (this.width) {
      img.style.width = `${this.width}px`;
    }
    img.onerror = () => { img.style.display = 'none'; };
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class CheckboxWidget extends WidgetType {
  readonly checked: boolean;
  readonly pos: number;
  constructor(checked: boolean, pos: number) {
    super();
    this.checked = checked;
    this.pos = pos;
  }
  eq(o: WidgetType) { return o instanceof CheckboxWidget && o.checked === this.checked && o.pos === this.pos; }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-lp-checkbox';
    box.setAttribute('tabindex', '-1');

    box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const replacement = this.checked ? '[ ]' : '[x]';
      view.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert: replacement } });
    });

    return box;
  }
  ignoreEvent() { return false; }
}

class CodeBlockWidget extends WidgetType {
  readonly code: string;
  readonly lang: string;
  constructor(code: string, lang: string) {
    super();
    this.code = code;
    this.lang = lang;
  }
  eq(o: WidgetType) { return o instanceof CodeBlockWidget && o.code === this.code && o.lang === this.lang; }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-lp-codeblock';

    const header = document.createElement('div');
    header.className = 'cm-lp-codeblock-header';

    const langBadge = document.createElement('span');
    langBadge.className = 'cm-lp-codeblock-lang';
    langBadge.textContent = this.lang || 'text';
    header.appendChild(langBadge);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-lp-codeblock-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    header.appendChild(copyBtn);
    wrap.appendChild(header);

    const pre = document.createElement('pre');
    pre.className = 'cm-lp-codeblock-body';
    const codeEl = document.createElement('code');
    codeEl.textContent = this.code;
    pre.appendChild(codeEl);
    wrap.appendChild(pre);

    return wrap;
  }
  ignoreEvent() { return false; }
}

class TableWidget extends WidgetType {
  readonly raw: string;
  constructor(raw: string) {
    super();
    this.raw = raw;
  }
  eq(o: WidgetType) { return o instanceof TableWidget && o.raw === this.raw; }

  toDOM(): HTMLElement {
    const lines = this.raw.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      const span = document.createElement('span');
      span.textContent = this.raw;
      return span;
    }

    const parseRow = (line: string): string[] => {
      const cells = line.split('|');
      if (cells.length > 0 && cells[0].trim() === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(c => c.trim());
    };

    const wrap = document.createElement('div');
    wrap.className = 'cm-lp-table-wrap';

    const table = document.createElement('table');
    table.className = 'cm-lp-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headerCells = parseRow(lines[0]);
    for (const cell of headerCells) {
      const th = document.createElement('th');
      th.textContent = cell;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 2; i < lines.length; i++) {
      const row = document.createElement('tr');
      const cells = parseRow(lines[i]);
      for (let c = 0; c < headerCells.length; c++) {
        const td = document.createElement('td');
        td.textContent = cells[c] || '';
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    return wrap;
  }
  ignoreEvent() { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cursorLines(state: EditorState): Set<number> {
  const s = new Set<number>();
  for (const { from, to } of state.selection.ranges) {
    const a = state.doc.lineAt(from).number;
    const b = state.doc.lineAt(to).number;
    for (let n = a; n <= b; n++) s.add(n);
  }
  return s;
}

function cursorInRange(state: EditorState, from: number, to: number): boolean {
  for (const { from: sf, to: st } of state.selection.ranges) {
    if (sf <= to && st >= from) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core decoration builder
// ─────────────────────────────────────────────────────────────────────────────

interface PendingDeco {
  from: number;
  to: number;
  deco: Decoration;
}

function buildDecorations(state: EditorState): DecorationSet {
  const pending: PendingDeco[] = [];
  const doc    = state.doc;
  const cl     = cursorLines(state);
  const onCursor = (pos: number) => cl.has(doc.lineAt(pos).number);
  const add    = (from: number, to: number, deco: Decoration) =>
    pending.push({ from, to, deco });

  const handledRanges: Array<{ from: number; to: number }> = [];

  // ── WikiLinks ───────────────────────────────────────────────────────────
  const fullText = doc.toString();
  const wikiLinkRegex = /\[\[([^\]\n]+)\]\]/g;
  let match;
  while ((match = wikiLinkRegex.exec(fullText)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (!onCursor(from)) {
      add(from, to, Decoration.replace({
        widget: new WikiLinkWidget(match[1]),
        block: false
      }));
    }
  }

  // ── Callouts ───────────────────────────────────────────────────────────
  const calloutRegex = /^>\s*\[!([^\]\n]+)\]/gm;
  let calloutMatch;
  while ((calloutMatch = calloutRegex.exec(fullText)) !== null) {
    const from = calloutMatch.index;
    const type = calloutMatch[1];

    let to = from;
    const lines = fullText.split('\n');
    const startLineNum = doc.lineAt(from).number;
    let currentLineNum = startLineNum;

    while (currentLineNum <= doc.lines) {
      const line = doc.line(currentLineNum);
      if (!line.text.startsWith('>')) break;
      currentLineNum++;
    }
    to = doc.line(currentLineNum - 1).to;

    if (!onCursor(from)) {
      const rawContent = doc.sliceString(from, to);
      const linesContent = rawContent.split('\n').map(l => l.replace(/^>\s?/, '').trim());
      const title = linesContent[0].replace(/^\[!([^\]]+)\]\s*(.*)/, '$2').trim();
      const body = linesContent.slice(1).join('\n').trim();

      add(from, to, Decoration.replace({
        widget: new CalloutWidget(type, title, body),
        block: true
      }));
    }
  }

  syntaxTree(state).iterate({
    from: 0, to: doc.length,
    enter(node) {
      const f = node.from;
      const t = node.to;

      for (const hr of handledRanges) {
        if (f >= hr.from && t <= hr.to) return;
      }

      switch (node.name) {
        case 'ATXHeading1':
        case 'ATXHeading2':
        case 'ATXHeading3':
        case 'ATXHeading4':
        case 'ATXHeading5':
        case 'ATXHeading6': {
          const lvl = node.name.slice(-1);
          const line = doc.lineAt(f);
          add(line.from, line.from, Decoration.line({ class: `cm-lp-h${lvl}` }));
          break;
        }
        case 'HeaderMark': {
          if (!onCursor(f)) {
            add(f, Math.min(t + 1, doc.lineAt(f).to), Decoration.replace({}));
          }
          break;
        }
        case 'EmphasisMark':
          if (!onCursor(f)) add(f, t, Decoration.replace({}));
          break;
        case 'Strikethrough la':
          if (!onCursor(f)) add(f, t, Decoration.replace({}));
          break;
        case 'CodeMark':
          if (node.node.parent?.name === 'FencedCode') {
            add(f, t, Decoration.mark({ class: 'cm-lp-code-mark text-muted-foreground' }));
          } else {
            if (!onCursor(f)) add(f, t, Decoration.replace({}));
          }
          break;
        case 'FencedCode': {
          if (!cursorInRange(state, f, t)) {
            const raw = doc.sliceString(f, t);
            const firstLine = raw.split('\n')[0];
            const langMatch = firstLine.match(/^```\s*(\S*)/);
            const lang = langMatch ? langMatch[1] : '';
            const allLines = raw.split('\n');
            const codeBody = allLines.slice(1, allLines.length - 1).join('\n');
            const startLine = doc.lineAt(f);
            const endLine = doc.lineAt(t);
            add(startLine.from, endLine.to, Decoration.replace({
              widget: new CodeBlockWidget(codeBody, lang),
              block: true
            }));
            handledRanges.push({ from: f, to: t });
          } else {
            const startL = doc.lineAt(f).number;
            const endL = doc.lineAt(t).number;
            for (let n = startL; n <= endL; n++) {
              const ln = doc.line(n);
              add(ln.from, ln.from, Decoration.line({ class: 'cm-lp-active-fenced' }));
            }
          }
          break;
        }
        case 'Blockquote': {
          const startL = doc.lineAt(f).number;
          const endL   = doc.lineAt(t).number;
          for (let n = startL; n <= endL; n++) {
            const ln = doc.line(n);
            add(ln.from, ln.from, Decoration.line({ class: 'cm-lp-blockquote' }));
          }
          break;
        }
        case 'QuoteMark':
          if (!onCursor(f)) add(f, Math.min(t + 1, doc.lineAt(f).to), Decoration.replace({}));
          break;
        case 'HorizontalRule': {
          if (!onCursor(f)) {
            const line = doc.lineAt(f);
            add(line.from, line.to, Decoration.replace({ widget: new HRWidget(), block: true }));
          }
          break;
        }
        case 'Image': {
          if (!onCursor(f)) {
            const raw = doc.sliceString(f, t);
            const m   = raw.match(/^!\[([^\]|]*)(?:\|(\d+))?\]\(([^)]+)\)/);
            if (m) {
              const [, alt, width, src] = m;
              const line = doc.lineAt(f);
              add(line.from, line.to, Decoration.replace({ widget: new ImageWidget(src, alt, width ? parseInt(width) : undefined), block: true }));
            }
          }
          break;
        }
        case 'Table': {
          if (!cursorInRange(state, f, t)) {
            const raw = doc.sliceString(f, t);
            const startLine = doc.lineAt(f);
            const endLine = doc.lineAt(t);
            add(startLine.from, endLine.to, Decoration.replace({
              widget: new TableWidget(raw),
              block: true
            }));
            handledRanges.push({ from: f, to: t });
          }
          break;
        }
        case 'TableDelimiter':
          if (onCursor(f)) {
            add(f, t, Decoration.mark({ class: 'cm-lp-pipe-active' }));
          } else {
            add(f, t, Decoration.mark({ class: 'cm-lp-pipe' }));
          }
          break;
        case 'ListMark':
          add(f, t, Decoration.mark({ class: 'cm-lp-list-mark' }));
          break;
        case 'TaskMarker': {
          if (!onCursor(f)) {
            const text    = doc.sliceString(f, t);
            const checked = /\[[xX]\]/.test(text);
            const bracketPos = f + text.indexOf('[');
            add(f, t, Decoration.replace({ widget: new CheckboxWidget(checked, bracketPos) }));
          }
          break;
        }
        case 'LinkMark':
          if (!onCursor(f)) add(f, t, Decoration.replace({}));
          break;
        case 'URL':
          if (!onCursor(f) && node.node.parent?.name !== 'Autolink') add(f, t, Decoration.replace({}));
          break;
      }
    },
  });

  pending.sort((a, b) => a.from !== b.from ? a.from - b.from : a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const { from, to: dTo, deco } of pending) {
    if (from < lastTo) continue;
    builder.add(from, dTo, deco);
    lastTo = dTo;
  }
  return builder.finish();
}

export const livePreviewExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state);
    }
    return value;
  },
  provide(f) {
    return EditorView.decorations.from(f);
  }
});
