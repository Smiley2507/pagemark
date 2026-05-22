import React from 'react';
import { ArrowRight, Award } from 'lucide-react';
import type { Template } from '../../types';
import { Button } from '@/components/ui/button';
interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onUse }) => (
  <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-sm">
    <div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-meta-sm font-medium text-muted-foreground">
          {template.category}
        </span>
        {template.is_builtin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta-sm font-medium">
            <Award className="h-3 w-3" />
            Built-in
          </span>
        )}
      </div>
      <h3 className="mt-3 text-section font-semibold text-foreground">{template.name}</h3>
      <p className="mt-2 line-clamp-3 text-meta text-muted-foreground">
        {template.description || 'Pre-structured documentation outline.'}
      </p>
    </div>
    <Button className="mt-5 w-full" onClick={() => onUse(template)}>
      Use template
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  </div>
);
