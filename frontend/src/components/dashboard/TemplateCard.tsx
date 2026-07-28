import React from 'react';
import { Award, Edit3, Trash2, Eye } from 'lucide-react';
import type { Template } from '../../types';

interface TemplateCardProps {
  template: Template;
  onClick: (template: Template) => void;
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onClick, onEdit, onDelete }) => {
  const isCustom = !template.is_builtin;
  return (
    <div
      className="relative flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-sm cursor-pointer"
      onClick={() => onClick(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(template); } }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-meta-sm font-medium text-muted-foreground">
            {template.category}
          </span>
          {template.is_builtin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta-sm font-medium">
              <Award className="h-3 w-3" />
              Built-in
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-meta-sm text-muted-foreground">
            <Eye className="h-3 w-3" />
            View details
          </span>
        </div>
        <h3 className="mt-3 text-section font-semibold text-foreground">{template.name}</h3>
        <p className="mt-2 line-clamp-3 text-meta text-muted-foreground">
          {template.description || 'Pre-structured documentation outline.'}
        </p>
      </div>
      {isCustom && (
        <div className="mt-4 flex gap-2 border-t border-border pt-3">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(template); }}
              className="flex items-center gap-1 rounded px-2 py-1 text-meta-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Edit template"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(template); }}
              className="flex items-center gap-1 rounded px-2 py-1 text-meta-sm text-muted-foreground hover:bg-accent hover:text-red-500 transition-colors"
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};
