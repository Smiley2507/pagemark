import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Loader2 } from 'lucide-react';
import { searchApi } from '@/api/search';
import type { SearchResult } from '@/types';

export const GlobalSearchOverlay: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const debouncedSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await searchApi.search(q);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => debouncedSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/editor/${item.project_id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search across all documentation..."
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:border-primary transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (query.trim() || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found</div>
          )}
          {results.map((item) => (
            <button
              key={`${item.project_id}-${item.section_id}`}
              onClick={() => handleSelect(item)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
            >
              <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.project_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">/</span>
                  <span className="text-xs text-muted-foreground truncate">{item.document_title}</span>
                </div>
                {item.section_heading && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.section_heading}</p>
                )}
                {item.content_excerpt && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{item.content_excerpt}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
