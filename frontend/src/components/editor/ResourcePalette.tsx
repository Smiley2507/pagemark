import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, Book, FileCode, Code, BookOpen, File, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { contextSearchApi } from '@/api/contextSearch';
import { useAiStore } from '@/store/aiStore';
import type { ContextSearchItem } from '@/types';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  section: FileText,
  document: Book,
  repo_file: FileCode,
  symbol: Code,
  note: BookOpen,
  upload: File,
};

const TYPE_LABELS: Record<string, string> = {
  section: 'Sections',
  document: 'Documents',
  repo_file: 'Source Files',
  symbol: 'Symbols',
  note: 'Notes',
  upload: 'Uploads',
};

const TYPE_ORDER: Record<string, number> = {
  section: 0,
  document: 1,
  repo_file: 2,
  symbol: 3,
  note: 4,
  upload: 5,
};

interface ResourcePaletteProps {
  projectId: number;
  open: boolean;
  onClose: () => void;
}

export function ResourcePalette({ projectId, open, onClose }: ResourcePaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContextSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addAttachment = useAiStore((s) => s.addAttachment);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await contextSearchApi.search(projectId, query, 20);
        setResults(res.results);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  const groupedResults = results.reduce<Record<string, ContextSearchItem[]>>((acc, item) => {
    const group = item.type;
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groupedResults).sort(
    ([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
  );

  const flatItems = sortedGroups.flatMap(([, items]) => items);

  const executeSelect = useCallback((item: ContextSearchItem) => {
    addAttachment({
      id: `ctx-${item.reference_type || item.type}-${item.reference_id || item.id}-${Date.now()}`,
      type: item.type === 'repo_file' ? 'source' : item.type === 'upload' ? 'file' : item.type as any,
      label: item.label,
      resourceId: item.reference_type === 'upload' ? item.reference_id ?? undefined : undefined,
    });
    onClose();
  }, [addAttachment, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && flatItems[selectedIndex]) {
        e.preventDefault();
        executeSelect(flatItems[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, flatItems, selectedIndex, executeSelect, onClose]);

  useEffect(() => {
    const selected = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-overlay-backdrop backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-xl rounded-lg border border-separator bg-overlay shadow-overlay">
        <div className="flex items-center gap-2 border-b border-separator px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources, files, symbols..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
          {query && !isLoading && (
            <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded border border-separator px-1.5 py-0.5 text-[10px] text-text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              Start typing to search across sections, documents, source files, and more
            </div>
          ) : flatItems.length === 0 && !isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No results found for "{query}"
            </div>
          ) : (
            sortedGroups.map(([type, items]) => {
              const GroupIcon = TYPE_ICONS[type] || File;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    <GroupIcon className="h-3 w-3" />
                    {TYPE_LABELS[type] || type}
                  </div>
                  {items.map((item) => {
                    const globalIdx = flatItems.indexOf(item);
                    const ItemIcon = TYPE_ICONS[type] || File;
                    return (
                      <button
                        key={item.id}
                        data-index={globalIdx}
                        onClick={() => executeSelect(item)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                          selectedIndex === globalIdx
                            ? 'bg-interaction-muted text-interaction-hover'
                            : 'text-text-primary hover:bg-panel-muted',
                        )}
                      >
                        <ItemIcon className="h-4 w-4 shrink-0 text-text-muted" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.label}</div>
                          {item.subtitle && (
                            <div className="truncate text-xs text-text-muted">{item.subtitle}</div>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-text-muted">
                          {TYPE_LABELS[type] || type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-separator px-4 py-1.5 text-[10px] text-text-muted">
          <span>↑↓ navigate</span>
          <span>⏎ select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
