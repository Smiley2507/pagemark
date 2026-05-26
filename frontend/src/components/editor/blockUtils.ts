import { Text } from '@codemirror/state';

export type BlockType = 'paragraph' | 'heading' | 'list' | 'table' | 'code-block' | 'blockquote' | 'hr' | 'image';

export interface BlockContext {
  from: number;
  to: number;
  type: BlockType;
  lineNumber: number;
}

/**
 * Identifies the block boundaries surrounding the given position.
 */
export function findBlockAtCursor(doc: Text, pos: number): BlockContext | null {
  const line = doc.lineAt(pos);
  const text = line.text;
  const lineNum = line.number;

  // 1. Check for Fenced Code Blocks (the most complex case as they span multiple lines)
  // We scan upwards and downwards to find the fences.
  let startLine = lineNum;
  let endLine = lineNum;
  let isCodeBlock = false;

  // Look up for the opening fence
  for (let n = lineNum; n >= 1; n--) {
    const l = doc.line(n);
    if (l.text.startsWith('```')) {
      startLine = n;
      isCodeBlock = true;
      break;
    }
  }
  if (isCodeBlock) {
    // Look down for the closing fence
    for (let n = lineNum; n <= doc.lines; n++) {
      const l = doc.line(n);
      if (l.text.startsWith('```')) {
        endLine = n;
        break;
      }
    }
    return {
      from: doc.line(startLine).from,
      to: doc.line(endLine).to,
      type: 'code-block',
      lineNumber: lineNum,
    };
  }

  // 2. Tables
  // We can reuse the logic from tableUtils if we want, but for simplicity:
  if (text.trim().startsWith('|') && text.trim().endsWith('|')) {
    // Table logic
    let tStart = lineNum;
    while (tStart > 1 && doc.line(tStart - 1).text.trim().startsWith('|')) tStart--;
    let tEnd = lineNum;
    while (tEnd < doc.lines && doc.line(tEnd + 1).text.trim().startsWith('|')) tEnd++;

    return {
      from: doc.line(tStart).from,
      to: doc.line(tEnd).to,
      type: 'table',
      lineNumber: lineNum,
    };
  }

  // 3. Headings
  if (text.startsWith('#')) {
    return {
      from: line.from,
      to: line.to,
      type: 'heading',
      lineNumber: lineNum,
    };
  }

  // 4. Blockquotes
  if (text.startsWith('>')) {
    let bStart = lineNum;
    while (bStart > 1 && doc.line(bStart - 1).text.startsWith('>')) bStart--;
    let bEnd = lineNum;
    while (bEnd < doc.lines && doc.line(bEnd + 1).text.startsWith('>')) bEnd++;

    return {
      from: doc.line(bStart).from,
      to: doc.line(bEnd).to,
      type: 'blockquote',
      lineNumber: lineNum,
    };
  }

  // 5. Lists
  if (text.trim().match(/^(\*|-|\d+\.)\s/)) {
    let lStart = lineNum;
    while (lStart > 1 && doc.line(lStart - 1).text.trim().match(/^(\*|-|\d+\.)\s/)) lStart--;
    let lEnd = lineNum;
    while (lEnd < doc.lines && doc.line(lEnd + 1).text.trim().match(/^(\*|-|\d+\.)\s/)) lEnd++;

    return {
      from: doc.line(lStart).from,
      to: doc.line(lEnd).to,
      type: 'list',
      lineNumber: lineNum,
    };
  }

  // 6. Horizontal Rule
  if (text.trim() === '---' || text.trim() === '***' || text.trim() === '___') {
    return {
      from: line.from,
      to: line.to,
      type: 'hr',
      lineNumber: lineNum,
    };
  }

  // 7. Image
  if (text.trim().startsWith('![')) {
    return {
      from: line.from,
      to: line.to,
      type: 'image',
      lineNumber: lineNum,
    };
  }

  // 8. Default: Paragraph
  return {
    from: line.from,
    to: line.to,
    type: 'paragraph',
    lineNumber: lineNum,
  };
}
