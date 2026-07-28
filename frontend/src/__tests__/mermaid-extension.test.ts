import { Editor } from '@tiptap/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createExtensions } from '@/components/editor/tiptap/editorSetup';

describe('MermaidDiagram extension', () => {
  beforeAll(() => {
    document.elementFromPoint = vi.fn(() => document.body);
  });

  it('loads Mermaid fences as diagram nodes and serializes them back to Markdown', () => {
    const editor = new Editor({
      extensions: createExtensions(),
      content: 'Before\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nAfter',
      contentType: 'markdown',
    });

    expect(editor.getJSON()).toMatchObject({
      content: expect.arrayContaining([
        expect.objectContaining({
          type: 'mermaidDiagram',
          attrs: expect.objectContaining({
            code: 'graph TD\n  A-->B',
          }),
        }),
      ]),
    });

    expect(editor.getMarkdown()).toContain('```mermaid\ngraph TD\n  A-->B\n```');
    editor.destroy();
  });

  it('updates serialized Markdown when Mermaid node attrs change', () => {
    const editor = new Editor({
      extensions: createExtensions(),
      content: '```mermaid\ngraph TD\n  A-->B\n```',
      contentType: 'markdown',
    });

    const pos = 0;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        code: 'sequenceDiagram\n  Alice->>Bob: Hello',
      }),
    );

    expect(editor.getMarkdown()).toContain(
      '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```',
    );
    editor.destroy();
  });
});
