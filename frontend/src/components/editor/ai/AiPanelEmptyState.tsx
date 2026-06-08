import { BookOpen, Sparkles, FileText, HelpCircle } from 'lucide-react';

interface SuggestionCard {
  icon: typeof BookOpen;
  label: string;
  action: string;
}

const SUGGESTIONS: SuggestionCard[] = [
  { icon: BookOpen, label: 'Generate API docs', action: 'Generate API documentation from the source code' },
  { icon: Sparkles, label: 'Improve this page', action: 'Refine this section for clarity and completeness' },
  { icon: FileText, label: 'Summarize notes', action: 'Summarize the key points of this document' },
  { icon: HelpCircle, label: 'Explain content', action: 'Explain selected content in simple terms' },
];

interface AiPanelEmptyStateProps {
  onSelectSuggestion: (action: string) => void;
}

export function AiPanelEmptyState({ onSelectSuggestion }: AiPanelEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-8">
      <div className="mb-3 rounded-full bg-indigo-500/10 p-2.5">
        <Sparkles className="h-5 w-5 text-indigo-500" />
      </div>
      <h2 className="text-base font-semibold text-text-primary">
        Hi, I&apos;m Mark
      </h2>
      <p className="mt-1 max-w-[240px] text-center text-xs text-text-muted leading-relaxed">
        I can help you write, improve, organize, and generate documentation for this project.
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => onSelectSuggestion(s.action)}
              className="group flex flex-col items-center gap-1.5 rounded-lg border border-separator bg-canvas px-3 py-3 text-center transition-all hover:border-interaction/30 hover:bg-panel-muted hover:shadow-sm"
            >
              <Icon className="h-4 w-4 text-text-muted group-hover:text-indigo-500 transition-colors" />
              <span className="text-xs font-medium text-text-primary">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
