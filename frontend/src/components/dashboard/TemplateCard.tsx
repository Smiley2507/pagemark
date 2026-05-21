import React from 'react';
import { BookOpen, Check, Award, ArrowRight } from 'lucide-react';
import type { Template } from '../../types';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onUse }) => {
  // Category coloring mapping
  const categoryConfig: Record<string, string> = {
    Technical: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    Developer: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50',
    Product: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50',
    Custom: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
  };

  const categoryStyle = categoryConfig[template.category] || categoryConfig.Custom;

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/70 dark:hover:border-indigo-900/50 backdrop-blur-sm"
      )}
    >
      {/* Dynamic top gradient line for premium visual interest */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div>
        {/* Badges container */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
            categoryStyle
          )}>
            {template.category}
          </span>

          {template.is_builtin ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
              <Award className="h-3 w-3" />
              Built-in
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              Custom
            </span>
          )}
        </div>

        {/* Template Title */}
        <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {template.name}
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed min-h-[3.75rem]">
          {template.description || "Get started with pre-structured default headings."}
        </p>
      </div>

      {/* Button CTA */}
      <div className="mt-6 pt-5 border-t border-slate-100/80 dark:border-slate-800/80">
        <button
          onClick={() => onUse(template)}
          className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-indigo-500 dark:hover:text-white shadow-sm hover:shadow-indigo-500/10 hover:shadow-md"
        >
          <span>Use Template</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
