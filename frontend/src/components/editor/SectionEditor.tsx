import { useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import type { Section } from '@/types';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

interface SectionEditorProps {
  section: Section;
  content: string;
  onChange: (value: string) => void;
  mode: 'view' | 'edit' | 'refine';
}

export function SectionEditor({ section, content, onChange, mode }: SectionEditorProps) {
  const { theme } = useThemeStore();

  const monacoTheme = useMemo(() => {
    if (theme === 'dark') return 'vs-dark';
    if (theme === 'light') return 'light';
    return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light';
  }, [theme]);

  const html = useMemo(() => {
    try {
      return marked.parse(content || '', { async: false }) as string;
    } catch {
      return '<p>Unable to render markdown.</p>';
    }
  }, [content]);

  useEffect(() => {
    marked.setOptions({ gfm: true, breaks: true });
  }, []);

  if (mode === 'view') {
    return (
      <div className="mx-auto max-w-3xl px-12 py-8">
        <h2 className="text-title font-semibold text-foreground">{section.heading}</h2>
        <div
          className={cn(
            'mt-4 max-w-none text-body leading-relaxed',
            '[&_h1]:mb-4 [&_h1]:text-title [&_h1]:font-semibold',
            '[&_h2]:mb-3 [&_h2]:text-section [&_h2]:font-semibold',
            '[&_h3]:mb-2 [&_h3]:font-semibold',
            '[&_p]:mb-3 [&_a]:text-primary [&_a]:underline',
            '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6',
            '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6',
            '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1',
            '[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4'
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border px-12 py-4">
          <h2 className="text-title font-semibold text-foreground">{section.heading}</h2>
        </div>
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            language="markdown"
            theme={monacoTheme}
            value={content}
            onChange={(v) => onChange(v ?? '')}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 14,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-12 py-8">
      <h2 className="text-title font-semibold text-foreground">{section.heading}</h2>
      <p className="mt-4 text-meta text-muted-foreground">
        AI Refine mode — use the assistant panel to generate suggestions, then review in the
        diff viewer.
      </p>
    </div>
  );
}
