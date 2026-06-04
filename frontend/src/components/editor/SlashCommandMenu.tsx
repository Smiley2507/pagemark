import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles, Table, ListCheck, AlertCircle, Wand2,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Code, Minus, Image, BookOpen, Sigma,
  ChevronRight, Hash, WrapText, TextQuote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { findBlockAtCursor } from './blockUtils';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  content: string;
  shortcut?: string;
  keywords?: string[];
  cursorOffset?: number;
}

interface CommandCategory {
  title: string;
  items: CommandAction[];
}

const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    title: 'AI Tools',
    items: [
      {
        id: 'ai-generate',
        label: 'Generate',
        icon: Sparkles,
        description: 'Generate content using AI',
        content: '',
        shortcut: '⌘I',
        keywords: ['draft', 'write', 'create'],
      },
      {
        id: 'ai-refine',
        label: 'Refine',
        icon: Wand2,
        description: 'Improve clarity and tone',
        content: '',
        shortcut: '⌘R',
        keywords: ['improve', 'rewrite', 'polish'],
      },
    ],
  },
  {
    title: 'Headings',
    items: [
      {
        id: 'insert-h1',
        label: 'Heading 1',
        icon: Heading1,
        description: 'Large section heading',
        content: '# ',
        shortcut: '#',
        keywords: ['h1', 'title'],
      },
      {
        id: 'insert-h2',
        label: 'Heading 2',
        icon: Heading2,
        description: 'Medium section heading',
        content: '## ',
        shortcut: '##',
        keywords: ['h2'],
      },
      {
        id: 'insert-h3',
        label: 'Heading 3',
        icon: Heading3,
        description: 'Small section heading',
        content: '### ',
        shortcut: '###',
        keywords: ['h3'],
      },
    ],
  },
  {
    title: 'Lists',
    items: [
      {
        id: 'insert-bullet-list',
        label: 'Bulleted List',
        icon: List,
        description: 'Simple bulleted list',
        content: '- ',
        shortcut: '-',
        keywords: ['ul', 'unordered'],
      },
      {
        id: 'insert-numbered-list',
        label: 'Numbered List',
        icon: ListOrdered,
        description: 'Ordered list',
        content: '1. ',
        shortcut: '1.',
        keywords: ['ol', 'ordered'],
      },
      {
        id: 'insert-checklist',
        label: 'Checklist',
        icon: ListCheck,
        description: 'Task list with checkboxes',
        content: '- [ ] ',
        shortcut: '[]',
        keywords: ['todo', 'task', 'checkbox'],
      },
    ],
  },
  {
    title: 'Blocks',
    items: [
      {
        id: 'insert-quote',
        label: 'Blockquote',
        icon: Quote,
        description: 'Pull quote or citation',
        content: '> ',
        shortcut: '>',
        keywords: ['quote', 'cite'],
      },
      {
        id: 'insert-code',
        label: 'Code Block',
        icon: Code,
        description: 'Code snippet with syntax highlighting',
        content: '```\n\n```',
        shortcut: '```',
        keywords: ['pre', 'snippet', 'fence'],
        cursorOffset: -4,
      },
      {
        id: 'insert-callout',
        label: 'Callout',
        icon: TextQuote,
        description: 'Highlighted info box',
        content: '> **Note:** ',
        keywords: ['info', 'note', 'alert'],
      },
      {
        id: 'insert-divider',
        label: 'Divider',
        icon: Minus,
        description: 'Horizontal rule',
        content: '---\n',
        shortcut: '---',
        keywords: ['hr', 'horizontal', 'line', 'separator'],
      },
      {
        id: 'insert-details',
        label: 'Details',
        icon: ChevronRight,
        description: 'Collapsible details block',
        content: '<details>\n<summary>Click to expand</summary>\n\n</details>\n',
        keywords: ['collapse', 'expand', 'spoiler'],
      },
    ],
  },
  {
    title: 'Media',
    items: [
      {
        id: 'insert-table',
        label: 'Table',
        icon: Table,
        description: 'Tabular content',
        content: '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |',
        keywords: ['grid', 'csv'],
      },
      {
        id: 'insert-image',
        label: 'Image',
        icon: Image,
        description: 'Insert an image',
        content: '![alt text](https://)',
        keywords: ['img', 'picture', 'photo', 'screenshot'],
      },
    ],
  },
  {
    title: 'Advanced',
    items: [
      {
        id: 'insert-toc',
        label: 'Table of Contents',
        icon: BookOpen,
        description: 'Auto-generated table of contents',
        content: '[[_TOC_]]\n',
        keywords: ['toc', 'index', 'outline'],
      },
      {
        id: 'insert-frontmatter',
        label: 'Frontmatter',
        icon: Hash,
        description: 'YAML frontmatter block',
        content: '---\ntitle: \ndescription: \n---\n',
        keywords: ['yaml', 'metadata', 'meta', 'header'],
      },
      {
        id: 'insert-math',
        label: 'Math (LaTeX)',
        icon: Sigma,
        description: 'Inline or block math',
        content: '$$',
        keywords: ['equation', 'formula', 'latex'],
        cursorOffset: 0,
      },
      {
        id: 'insert-html',
        label: 'HTML Block',
        icon: WrapText,
        description: 'Raw HTML block',
        content: '<div>\n\n</div>\n',
        keywords: ['raw', 'embed', 'custom'],
      },
    ],
  },
];

const ALL_ACTIONS = COMMAND_CATEGORIES.flatMap((c) => c.items);

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  slashPos: number;
  searchTerm: string;
  onClose: () => void;
  editor: any;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function SlashCommandMenu({
  position,
  slashPos,
  searchTerm,
  onClose,
  editor,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return COMMAND_CATEGORIES;
    const q = searchTerm.toLowerCase();
    return COMMAND_CATEGORIES.map((cat) => {
      const items = cat.items.filter((item) => {
        const fields = [
          item.label,
          item.description,
          item.shortcut ?? '',
          ...(item.keywords ?? []),
        ];
        return fields.some((f) => fuzzyMatch(f, q));
      });
      return { ...cat, items };
    }).filter((cat) => cat.items.length > 0);
  }, [searchTerm]);

  const filteredActions = useMemo(
    () => filteredCategories.flatMap((c) => c.items),
    [filteredCategories],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const executeAction = (action: CommandAction) => {
    const { state } = editor;
    const pos = state.selection.main.from;
    const block = findBlockAtCursor(state.doc, pos);

    if (block && block.type !== 'paragraph') {
      let transformationText = '';
      if (action.id === 'insert-h1')
        transformationText = '# ' + state.doc.sliceString(block.from + 1, block.to).trim();
      else if (action.id === 'insert-h2')
        transformationText = '## ' + state.doc.sliceString(block.from + 1, block.to).trim();
      else if (action.id === 'insert-h3')
        transformationText = '### ' + state.doc.sliceString(block.from + 1, block.to).trim();
      else if (action.id === 'insert-quote')
        transformationText = '> ' + state.doc.sliceString(block.from, block.to);
      else if (action.id === 'insert-divider')
        transformationText = '---';

      if (transformationText) {
        editor.dispatch({
          changes: { from: block.from, to: block.to, insert: transformationText + '\n' },
          selections: [{ anchor: block.from, head: block.from }],
        });
        onClose();
        return;
      }
    }

    const offset =
      action.cursorOffset !== undefined
        ? action.cursorOffset
        : action.content.length;

    editor.dispatch({
      changes: {
        from: slashPos,
        to: slashPos + 1 + searchTerm.length,
        insert: action.content,
      },
      selection: { anchor: slashPos + offset },
    });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredActions.length === 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeAction(filteredActions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedIndex, editor, onClose, slashPos, filteredActions, searchTerm]);

  useEffect(() => {
    if (!containerRef.current) return;
    const btn = containerRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement;
    btn?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      className="fixed z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 h-5 text-[10px] font-mono text-muted-foreground">
            /
          </kbd>
          <span className="text-xs text-muted-foreground">
            {searchTerm ? `Filtering "${searchTerm}"` : 'Type to filter commands'}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="max-h-72 overflow-y-auto py-1">
        {filteredCategories.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No commands found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          filteredCategories.map((cat, catIdx) => {
            let offset = 0;
            for (let i = 0; i < catIdx; i++) {
              offset += filteredCategories[i].items.length;
            }

            return (
              <div key={cat.title}>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat.title}
                </div>
                {cat.items.map((action, idx) => {
                  const gi = offset + idx;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      data-index={gi}
                      onClick={() => executeAction(action)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                        selectedIndex === gi
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                          selectedIndex === gi ? 'bg-background' : 'bg-muted',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {action.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {action.description}
                        </div>
                      </div>
                      {action.shortcut && (
                        <kbd className="shrink-0 inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 h-5 text-[10px] font-mono text-muted-foreground">
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border px-3 py-1.5 flex items-center gap-3">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1 h-4 text-[9px] font-mono">
            ↑↓
          </kbd>
          navigate
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1 h-4 text-[9px] font-mono">
            ⏎
          </kbd>
          select
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1 h-4 text-[9px] font-mono">
            esc
          </kbd>
          close
        </div>
      </div>
    </div>
  );
}
