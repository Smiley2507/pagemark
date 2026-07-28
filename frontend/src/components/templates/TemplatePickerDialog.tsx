import { useMemo, useState } from 'react';
import { useTemplates } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Award, ArrowRight, X, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Template } from '@/types';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: Template | null) => void;
  selected: Template | null;
}

export function TemplatePickerDialog({ open, onOpenChange, onSelect, selected }: TemplatePickerDialogProps) {
  const { data: templates, isLoading } = useTemplates();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = search.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const builtIn = filtered.filter((t) => t.is_builtin);
  const custom = filtered.filter((t) => !t.is_builtin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse templates</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <LayoutTemplate className="h-8 w-8" />
              <p className="text-sm">No templates found</p>
            </div>
          ) : (
            <>
              {builtIn.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Built-in</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {builtIn.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        isSelected={selected?.id === t.id}
                        onSelect={() => onSelect(t)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {custom.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your templates</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {custom.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        isSelected={selected?.id === t.id}
                        onSelect={() => onSelect(t)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {selected && (
              <Button variant="outline" onClick={() => { onSelect(null); onOpenChange(false); }}>
                <X className="mr-1.5 h-4 w-4" />
                Clear
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>
              {selected ? 'Confirm' : 'Skip'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, isSelected, onSelect }: { template: Template; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all w-full',
        isSelected
          ? 'border-primary bg-accent'
          : 'border-border bg-card hover:bg-accent/50',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {template.category}
        </span>
        {template.is_builtin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Award className="h-3 w-3" />
            Built-in
          </span>
        )}
      </div>
      <span className="text-sm font-semibold">{template.name}</span>
      {template.description && (
        <span className="text-xs text-muted-foreground line-clamp-2">{template.description}</span>
      )}
    </button>
  );
}
