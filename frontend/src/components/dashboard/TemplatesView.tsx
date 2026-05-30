import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateCard } from './TemplateCard';
import { useTemplates, useCreateTemplate } from '@/hooks/useProjects';
import { ErrorBanner } from './DashboardViews';
import type { Template } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const TemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('Technical');
  const [newTemplateSections, setNewTemplateSections] = useState<string[]>([
    'Overview',
    'Architecture',
    'Implementation',
  ]);
  const [customSectionInput, setCustomSectionInput] = useState('');

  const {
    data: templatesList,
    isLoading: templatesLoading,
    isError: templatesError,
    refetch: refetchTemplates,
  } = useTemplates();

  const createTemplateMutation = useCreateTemplate();

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    await createTemplateMutation.mutateAsync({
      name: newTemplateName,
      description: newTemplateDesc,
      category: newTemplateCategory,
      sections_json: newTemplateSections,
    });
    setNewTemplateName('');
    setNewTemplateDesc('');
    setNewTemplateCategory('Technical');
    setNewTemplateSections(['Overview', 'Architecture', 'Implementation']);
    setIsTemplateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section font-semibold">Outlines</h2>
          <p className="text-meta text-muted-foreground">
            Built-in and custom documentation structures
          </p>
        </div>
        <Button onClick={() => setIsTemplateModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create template
        </Button>
      </div>

      {templatesError && (
        <ErrorBanner
          message="Failed to load templates"
          onRetry={() => refetchTemplates()}
        />
      )}

      {templatesLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!templatesLoading && !templatesError && templatesList && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templatesList.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              onUse={(t: Template) =>
                navigate(`/new-project?template_id=${t.id}`)
              }
            />
          ))}
        </div>
      )}

      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-slide-up rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-section font-semibold">Create template</h3>
            <form onSubmit={handleCreateTemplate} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tmpl-name">Name</Label>
                <Input
                  id="tmpl-name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tmpl-desc">Description</Label>
                <Input
                  id="tmpl-desc"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tmpl-cat">Category</Label>
                <select
                  id="tmpl-cat"
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body"
                >
                  <option>Technical</option>
                  <option>Developer</option>
                  <option>Product</option>
                  <option>Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Sections</Label>
                <div className="flex gap-2">
                  <Input
                    value={customSectionInput}
                    onChange={(e) => setCustomSectionInput(e.target.value)}
                    placeholder="Add heading…"
                  />
                    <Button
                      type="button"
                      onClick={() => {
                        if (customSectionInput.trim()) {
                          setNewTemplateSections((p) => [...p, customSectionInput.trim()]);
                          setCustomSectionInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newTemplateSections.map((sec, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-meta-sm"
                    >
                      {sec}
                      <button
                        type="button"
                        onClick={() =>
                          setNewTemplateSections((p) => p.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTemplateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
