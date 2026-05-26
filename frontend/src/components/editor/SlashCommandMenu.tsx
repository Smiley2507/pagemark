import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Table, ListCheck, AlertCircle, Wand2, 
  Heading1, Heading2, Heading3, List, ListOrdered, 
  Quote, Code, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Command definitions ───────────────────────────────────────────────────────

export interface CommandAction {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  content: string;
  shortcut?: string;
}

export interface CommandCategory {
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
        description: 'Generate content for this section using AI',
        content: 'AI is generating content...',
      },
      {
        id: 'ai-refine',
        label: 'Refine',
        icon: Wand2,
        description: 'Improve the clarity and professional tone',
        content: '[Refinement in progress...]',
      },
    ]
  },
  {
    title: 'Basic Blocks',
    items: [
      {
        id: 'insert-h1',
        label: 'Heading 1',
        icon: Heading1,
        description: 'Large section heading',
        content: '# ',
        shortcut: '#',
      },
      {
        id: 'insert-h2',
        label: 'Heading 2',
        icon: Heading2,
        description: 'Medium section heading',
        content: '## ',
        shortcut: '##',
      },
      {
        id: 'insert-h3',
        label: 'Heading 3',
        icon: Heading3,
        description: 'Small section heading',
        content: '### ',
        shortcut: '###',
      },
      {
        id: 'insert-bullet-list',
        label: 'Bulleted List',
        icon: List,
        description: 'Create a simple bulleted list',
        content: '- ',
        shortcut: '-',
      },
      {
        id: 'insert-numbered-list',
        label: 'Numbered List',
        icon: ListOrdered,
        description: 'Create a list with numbering',
        content: '1. ',
        shortcut: '1.',
      },
      {
        id: 'insert-checklist',
        label: 'Checklist',
        icon: ListCheck,
        description: 'Track tasks with a to-do list',
        content: '- [ ] ',
        shortcut: '[]',
      },
      {
        id: 'insert-quote',
        label: 'Quote',
        icon: Quote,
        description: 'Capture a quote',
        content: '> ',
        shortcut: '>',
      },
    ]
  },
  {
    title: 'Media & Advanced',
    items: [
      {
        id: 'insert-table',
        label: 'Table',
        icon: Table,
        description: 'Add simple tabular content',
        content: '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |',
      },
      {
        id: 'insert-code',
        label: 'Code Block',
        icon: Code,
        description: 'Capture a code snippet',
        content: '```\n\n```',
        shortcut: '```',
      },
      {
        id: 'insert-divider',
        label: 'Divider',
        icon: Minus,
        description: 'Visually divide blocks',
        content: '---\n',
        shortcut: '---',
      },
      {
        id: 'insert-callout',
        label: 'Callout',
        icon: AlertCircle,
        description: 'Make text stand out',
        content: '> **Note:** ',
      },
    ]
  }
];

// Flatten for easy index-based navigation
const ALL_ACTIONS = COMMAND_CATEGORIES.flatMap(c => c.items);

// ── Props ─────────────────────────────────────────────────────────────────────

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  slashPos: number;
  searchTerm: string;
  onClose: () => void;
  editor: any;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlashCommandMenu({ position, slashPos, searchTerm, onClose, editor }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived filtered categories
  const filteredCategories = React.useMemo(() => {
    if (!searchTerm) return COMMAND_CATEGORIES;
    const lowerSearch = searchTerm.toLowerCase();
    
    return COMMAND_CATEGORIES.map(category => {
      const filteredItems = category.items.filter(item => 
        item.label.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(lowerSearch))
      );
      return { ...category, items: filteredItems };
    }).filter(category => category.items.length > 0);
  }, [searchTerm]);

  const filteredActions = React.useMemo(() => 
    filteredCategories.flatMap(c => c.items),
  [filteredCategories]);

  // Reset selected index when search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Execute the selected action
  const executeAction = (action: CommandAction) => {
    // Determine where to place the cursor. 
    // For things like code blocks, we might want the cursor inside the block.
    let cursorOffset = action.content.length;
    if (action.id === 'insert-code') cursorOffset -= 4; // place inside backticks

    editor.dispatch({
      changes: { from: slashPos, to: slashPos + 1 + searchTerm.length, insert: action.content },
      selection: { anchor: slashPos + cursorOffset },
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
        setSelectedIndex((prev) => {
          const next = (prev + 1) % filteredActions.length;
          scrollToIndex(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          const next = (prev - 1 + filteredActions.length) % filteredActions.length;
          scrollToIndex(next);
          return next;
        });
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

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const button = containerRef.current.querySelector(`[data-index="${index}"]`) as HTMLElement;
    if (button) {
      button.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div
      className="fixed z-50 w-[320px] max-h-[360px] flex flex-col bg-surface-elevated border border-border-default rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 border-b border-border-default bg-surface-subtle">
        <div className="text-xs font-medium text-muted-foreground px-1">
          Type to filter or arrow keys to navigate
        </div>
      </div>
      
      <div ref={containerRef} className="overflow-y-auto p-1.5 space-y-3">
        {filteredCategories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No matching commands found
          </div>
        ) : (
          filteredCategories.map((category, catIdx) => {
            // Calculate the global index for the first item in this category
            let globalIdxOffset = 0;
            for (let i = 0; i < catIdx; i++) {
              globalIdxOffset += filteredCategories[i].items.length;
            }

            return (
              <div key={category.title}>
                <div className="px-2 py-1 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category.title}
                </div>
                <div className="space-y-0.5">
                  {category.items.map((action, idx) => {
                    const globalIdx = globalIdxOffset + idx;
                  return (
                    <button
                      key={action.id}
                      data-index={globalIdx}
                      onClick={() => executeAction(action)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors',
                        selectedIndex === globalIdx
                          ? 'bg-accent/15 text-accent-foreground'
                          : 'text-text-2 hover:bg-surface-hover hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={cn(
                          "shrink-0 flex items-center justify-center w-8 h-8 rounded border",
                          selectedIndex === globalIdx
                            ? 'bg-background border-border-default'
                            : 'bg-surface border-transparent'
                        )}>
                          <action.icon className={cn(
                            "h-4 w-4",
                            selectedIndex === globalIdx ? "text-foreground" : "text-muted-foreground"
                          )} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={cn(
                            "text-sm font-medium truncate",
                            selectedIndex === globalIdx ? "text-foreground" : ""
                          )}>{action.label}</span>
                          <span className="text-[11px] text-muted-foreground truncate">{action.description}</span>
                        </div>
                      </div>
                      {action.shortcut && (
                        <div className="shrink-0 pl-2">
                          <kbd className="inline-flex items-center rounded border border-border-default bg-surface px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {action.shortcut}
                          </kbd>
                        </div>
                      )}
                    </button>
                  );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
