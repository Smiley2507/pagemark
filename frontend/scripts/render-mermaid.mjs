import { createHash } from 'node:crypto';
import { stdin as input, stdout, stderr } from 'node:process';
import { JSDOM } from 'jsdom';

const chunks = [];
for await (const chunk of input) {
  chunks.push(chunk);
}

const source = Buffer.concat(chunks).toString('utf8');
const dom = new JSDOM('<!doctype html><html><body></body></html>');

for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  Element: dom.window.Element,
  SVGElement: dom.window.SVGElement,
  CSSStyleSheet: dom.window.CSSStyleSheet,
  DOMParser: dom.window.DOMParser,
})) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  });
}

globalThis.SVGElement.prototype.getBBox ??= function getBBox() {
  const tag = String(this.tagName || '').toLowerCase();
  const isTextNode = tag === 'text' || tag === 'tspan';
  const width = isTextNode ? Math.max((this.textContent || '').length * 8, 16) : 16;
  return { x: 0, y: 0, width, height: 16 };
};

globalThis.SVGElement.prototype.getComputedTextLength ??= function getComputedTextLength() {
  return Math.max((this.textContent || '').length * 8, 16);
};

try {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
  });
  const id = `pagemark-mermaid-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
  const { svg } = await mermaid.render(id, source);
  stdout.write(svg);
} catch (error) {
  stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
