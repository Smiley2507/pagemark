import React, { useState, useCallback } from 'react';
import { PlusCircle, ChevronDown, ChevronRight, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateCard } from './TemplateCard';
import { TemplateDetailModal } from './TemplateDetailModal';
import { useTemplates, useCreateTemplate } from '@/hooks/useProjects';
import { ErrorBanner } from './DashboardViews';
import type { Template } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';
import { toast } from 'sonner';
import { projectsApi } from '@/api/projects';

interface SectionField {
  heading: string;
  description: string;
  guidance: string;
  expected_sources: string;
}

function emptySection(): SectionField {
  return { heading: '', description: '', guidance: '', expected_sources: '' };
}

function sectionToField(sec: any): SectionField {
  if (typeof sec === 'string') return { heading: sec, description: '', guidance: '', expected_sources: '' };
  return {
    heading: sec.heading || '',
    description: sec.description || '',
    guidance: sec.guidance || '',
    expected_sources: Array.isArray(sec.expected_sources) ? sec.expected_sources.join(', ') : '',
  };
}

function fieldsToSections(fields: SectionField[]): any[] {
  return fields.map((f) => {
    const s: any = { heading: f.heading };
    if (f.description) s.description = f.description;
    if (f.guidance) s.guidance = f.guidance;
    if (f.expected_sources.trim()) s.expected_sources = f.expected_sources.split(',').map((s) => s.trim()).filter(Boolean);
    return s;
  });
}

const CATEGORIES = ['Technical', 'Developer', 'Product', 'Custom'];

export const TemplatesView: React.FC = () => {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplatePurpose, setNewTemplatePurpose] = useState('');
  const [newTemplateAudience, setNewTemplateAudience] = useState('');
  const [newTemplateOutcome, setNewTemplateOutcome] = useState('');
  const [newTemplateGuidance, setNewTemplateGuidance] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('Technical');
  const [newTemplateSections, setNewTemplateSections] = useState<SectionField[]>([
    { heading: 'Overview', description: '', guidance: '', expected_sources: '' },
    { heading: 'Architecture', description: '', guidance: '', expected_sources: '' },
    { heading: 'Implementation', description: '', guidance: '', expected_sources: '' },
  ]);
  const [newTemplateSystemPrompt, setNewTemplateSystemPrompt] = useState('');
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const {
    data: templatesList,
    isLoading: templatesLoading,
    isError: templatesError,
    refetch: refetchTemplates,
  } = useTemplates();

  const createTemplateMutation = useCreateTemplate();

  const openCreateModal = () => {
    setEditTemplate(null);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setNewTemplatePurpose('');
    setNewTemplateAudience('');
    setNewTemplateOutcome('');
    setNewTemplateGuidance('');
    setNewTemplateCategory('Technical');
    setNewTemplateSections([
      { heading: 'Overview', description: '', guidance: '', expected_sources: '' },
      { heading: 'Architecture', description: '', guidance: '', expected_sources: '' },
      { heading: 'Implementation', description: '', guidance: '', expected_sources: '' },
    ]);
    setNewTemplateSystemPrompt('');
    setExpandedSection(null);
    setIsTemplateModalOpen(true);
  };

  const openEditModal = (t: Template) => {
    setEditTemplate(t);
    setNewTemplateName(t.name);
    setNewTemplateDesc(t.description || '');
    setNewTemplatePurpose(t.purpose || '');
    setNewTemplateAudience(t.intended_audience || '');
    setNewTemplateOutcome(t.expected_outcome || '');
    setNewTemplateGuidance(t.guidance || '');
    setNewTemplateCategory(t.category || 'Technical');
    const raw = t.sections_json as any[] | undefined;
    setNewTemplateSections(raw && raw.length > 0 ? raw.map(sectionToField) : [emptySection()]);
    setNewTemplateSystemPrompt(t.system_prompt || '');
    setExpandedSection(null);
    setIsTemplateModalOpen(true);
  };

  const resetModal = () => {
    setEditTemplate(null);
    setIsTemplateModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    const payload: any = {
      name: newTemplateName,
      description: newTemplateDesc || undefined,
      category: newTemplateCategory,
      purpose: newTemplatePurpose || undefined,
      intended_audience: newTemplateAudience || undefined,
      expected_outcome: newTemplateOutcome || undefined,
      guidance: newTemplateGuidance || undefined,
      sections_json: fieldsToSections(newTemplateSections),
      system_prompt: newTemplateSystemPrompt || undefined,
    };
    try {
      if (editTemplate) {
        await projectsApi.updateTemplate(editTemplate.id, payload);
        toast.success('Template updated');
      } else {
        await createTemplateMutation.mutateAsync(payload);
      }
      resetModal();
      refetchTemplates();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save template');
    }
  };

  const addSection = () => {
    setNewTemplateSections((p) => [...p, emptySection()]);
    setExpandedSection(newTemplateSections.length);
  };

  const removeSection = (idx: number) => {
    setNewTemplateSections((p) => p.filter((_, i) => i !== idx));
    setExpandedSection((prev) => (prev === idx ? null : prev));
  };

  const updateSection = (idx: number, field: keyof SectionField, value: string) => {
    setNewTemplateSections((p) => p.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <Surface variant="panel" padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-separator px-5 py-4">
          <div>
            <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Templates</p>
            <h2 className="text-section font-semibold text-text-primary">Document structures</h2>
          </div>
          <Button onClick={openCreateModal}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create template
          </Button>
        </div>

        <div className="bg-panel-muted/55 p-3">
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

          {!templatesLoading && !templatesError && templatesList && templatesList.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templatesList.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  template={tmpl}
                  onClick={(t) => setDetailTemplate(t)}
                  onEdit={openEditModal}
                  onDelete={async (t) => {
                    if (!confirm(`Delete template "${t.name}"?`)) return;
                    try {
                      await projectsApi.deleteTemplate(t.id);
                      toast.success('Template deleted');
                      refetchTemplates();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.detail || 'Failed to delete template');
                    }
                  }}
                />
              ))}
            </div>
          )}

          {!templatesLoading && !templatesError && (!templatesList || templatesList.length === 0) && (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <p className="text-text-secondary">No templates yet.</p>
            </div>
          )}
        </div>
      </Surface>

      {detailTemplate && (
        <TemplateDetailModal
          template={detailTemplate}
          onClose={() => setDetailTemplate(null)}
          onEdit={(t) => { setDetailTemplate(null); openEditModal(t); }}
          onDelete={async (t) => {
            if (!confirm(`Delete template "${t.name}"?`)) return;
            try {
              await projectsApi.deleteTemplate(t.id);
              toast.success('Template deleted');
              refetchTemplates();
              setDetailTemplate(null);
            } catch (e: any) {
              toast.error(e?.response?.data?.detail || 'Failed to delete template');
            }
          }}
        />
      )}

      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-section font-semibold">{editTemplate ? 'Edit template' : 'Create template'}</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tmpl-name">Name</Label>
                <Input id="tmpl-name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-desc">Description</Label>
                <textarea
                  id="tmpl-desc"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
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
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-purpose">Purpose</Label>
                <textarea
                  id="tmpl-purpose"
                  value={newTemplatePurpose}
                  onChange={(e) => setNewTemplatePurpose(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                  placeholder="What kind of document is this template for? What problem does it solve?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-audience">Intended Audience</Label>
                <textarea
                  id="tmpl-audience"
                  value={newTemplateAudience}
                  onChange={(e) => setNewTemplateAudience(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                  placeholder="Who will read this document?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-outcome">Expected Outcome</Label>
                <textarea
                  id="tmpl-outcome"
                  value={newTemplateOutcome}
                  onChange={(e) => setNewTemplateOutcome(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                  placeholder="What should the reader be able to do after reading?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-guidance">Writing Guidance</Label>
                <textarea
                  id="tmpl-guidance"
                  value={newTemplateGuidance}
                  onChange={(e) => setNewTemplateGuidance(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                  placeholder="Tone, structure rules, what to include or exclude per section type."
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Sections</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSection}>Add section</Button>
                </div>
                <div className="space-y-2">
                  {newTemplateSections.map((sec, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-muted/30">
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                        onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        {expandedSection === idx ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="flex-1 text-body text-foreground truncate">
                          {sec.heading || `Section ${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeSection(idx); }}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {expandedSection === idx && (
                        <div className="space-y-2 border-t border-border px-3 py-3">
                          <Input
                            value={sec.heading}
                            onChange={(e) => updateSection(idx, 'heading', e.target.value)}
                            placeholder="Section heading"
                          />
                          <textarea
                            value={sec.description}
                            onChange={(e) => updateSection(idx, 'description', e.target.value)}
                            placeholder="Section description"
                            rows={2}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                          />
                          <textarea
                            value={sec.guidance}
                            onChange={(e) => updateSection(idx, 'guidance', e.target.value)}
                            placeholder="AI guidance for this section (what to include, what to avoid)"
                            rows={2}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none"
                          />
                          <Input
                            value={sec.expected_sources}
                            onChange={(e) => updateSection(idx, 'expected_sources', e.target.value)}
                            placeholder="Expected source paths (comma-separated)"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpl-prompt">AI System Prompt</Label>
                <textarea
                  id="tmpl-prompt"
                  value={newTemplateSystemPrompt}
                  onChange={(e) => setNewTemplateSystemPrompt(e.target.value)}
                  placeholder="e.g., You are generating an API reference document. Use the repository analysis to identify every endpoint..."
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body placeholder:text-muted-foreground resize-none font-mono text-meta-sm"
                />
                <p className="text-meta-sm text-muted-foreground">
                  The full system prompt sent to the AI when generating a document from this template.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetModal}>Cancel</Button>
                <Button type="submit">{editTemplate ? 'Save' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
