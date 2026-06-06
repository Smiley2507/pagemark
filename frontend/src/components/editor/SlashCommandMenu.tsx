import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Pilcrow,
  Quote,
  Table,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { findBlockAtCursor } from './blockUtils';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  content: string;
  keywords: string[];
  cursorOffset?: number;
}

const COMMANDS: CommandAction[] = [
  {
    id: 'paragraph',
    label: 'Paragraph',
    icon: Pilcrow,
    description: 'Plain text block',
    content: '',
    keywords: ['text', 'normal', 'plain'],
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    icon: Heading1,
    description: 'Top-level heading',
    content: '# ',
    keywords: ['h1', 'title'],
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    icon: Heading2,
    description: 'Section heading',
    content: '## ',
    keywords: ['h2', 'section'],
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    icon: Heading3,
    description: 'Subsection heading',
    content: '### ',
    keywords: ['h3', 'subsection'],
  },
  {
    id: 'checklist',
    label: 'Checklist',
    icon: CheckSquare,
    description: 'Task list item',
    content: '- [ ] ',
    keywords: ['task', 'todo', 'checkbox'],
  },
  {
    id: 'code-block',
    label: 'Code Block',
    icon: Code,
    description: 'Fenced code block',
    content: '```\n\n```',
    keywords: ['code', 'fence', 'snippet'],
    cursorOffset: 4,
  },
  {
    id: 'table',
    label: 'Table',
    icon: Table,
    description: 'Two-column markdown table',
    content: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |',
    keywords: ['grid', 'columns', 'advanced tables'],
    cursorOffset: 33,
  },
  {
    id: 'quote-callout',
    label: 'Quote/Callout',
    icon: Quote,
    description: 'Blockquote or callout',
    content: '> [!info] Note\n> ',
    keywords: ['quote', 'blockquote', 'callout', 'note'],
    cursorOffset: 18,
  },
  {
    id: 'horizontal-rule',
    label: 'Horizontal Rule',
    icon: Minus,
    description: 'Document divider',
    content: '---\n',
    keywords: ['divider', 'line', 'hr', 'separator'],
  },
];

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  slashPos: number;
  searchTerm: string;
  onClose: () => void;
  editor: any;
}

function matchesCommand(action: CommandAction, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return [action.label, action.description, ...action.keywords].some((field) =>
    field.toLowerCase().includes(normalized),
  );
}

function transformCurrentBlock(editor: any, action: CommandAction): boolean {
  const { state } = editor;
  const pos = state.selection.main.from;
  const block = findBlockAtCursor(state.doc, pos);
  if (!block) return false;

  const blockText = state.doc.sliceString(block.from, block.to);
  const withoutSlash = blockText.replace(/(?:^|\s)\/\S*$/, '').trim();

  let replacement = '';
  if (action.id === 'paragraph') replacement = withoutSlash;
  if (action.id === 'heading-1') replacement = `# ${withoutSlash}`;
  if (action.id === 'heading-2') replacement = `## ${withoutSlash}`;
  if (action.id === 'heading-3') replacement = `### ${withoutSlash}`;

  if (!replacement && action.id !== 'paragraph') return false;

  editor.dispatch({
    changes: { from: block.from, to: block.to, insert: replacement },
    selection: { anchor: block.from + replacement.length },
    scrollIntoView: true,
  });
  return true;
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

  const filteredActions = useMemo(
    () => COMMANDS.filter((action) => matchesCommand(action, searchTerm)),
    [searchTerm],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const executeAction = (action: CommandAction) => {
    if (transformCurrentBlock(editor, action)) {
      onClose();
      return;
    }

    const offset = action.cursorOffset ?? action.content.length;
    editor.dispatch({
      changes: {
        from: slashPos,
        to: slashPos + 1 + searchTerm.length,
        insert: action.content,
      },
      selection: { anchor: slashPos + offset },
      scrollIntoView: true,
    });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (filteredActions.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((previous) => (previous + 1) % filteredActions.length);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((previous) => (previous - 1 + filteredActions.length) % filteredActions.length);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        executeAction(filteredActions[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedIndex, filteredActions, onClose, editor, slashPos, searchTerm]);

  useEffect(() => {
    const selected = containerRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      className="fixed z-50 w-72 border border-border bg-popover shadow-overlay"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Slash commands"
    >
      <div className="border-b border-border px-3 py-2 text-meta text-text-secondary">
        {searchTerm ? `/${searchTerm}` : 'Commands'}
      </div>

      <div ref={containerRef} className="max-h-72 overflow-y-auto py-1">
        {filteredActions.length === 0 ? (
          <div className="px-3 py-6 text-center text-meta text-text-muted">No commands found</div>
        ) : (
          filteredActions.map((action, index) => {
            const Icon = action.icon;
            const selected = selectedIndex === index;
            return (
              <button
                key={action.id}
                data-index={index}
                role="option"
                aria-selected={selected}
                onClick={() => executeAction(action)}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'h-auto w-full justify-start gap-2 px-3 py-2 text-left',
                  selected && 'bg-accent text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{action.label}</span>
                  <span className="block truncate text-meta text-text-muted">{action.description}</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-meta text-text-muted">
        <span>↑↓ navigate</span>
        <span>Enter select</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}
