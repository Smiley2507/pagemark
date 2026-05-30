import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Folder,
  Layers,
  Settings,
  Plus,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { Icon } from '@/components/icons/Icon';
import { useAuthStore } from '@/store/authStore';
import {
  useProjects,
  useDeleteProject,
  useDuplicateProject,
  useStarProject,
  useTemplates,
  useCreateTemplate,
} from '@/hooks/useProjects';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { TemplateCard } from '@/components/dashboard/TemplateCard';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { QualityModal } from '@/components/editor/QualityModal';
import { AppHeader } from '@/components/layout/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Template } from '@/types';
import { AiProvidersSection } from '@/components/settings/AiProvidersSection';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    if (searchParams.get('tab') === 'settings') {
      setActiveTab('settings');
    }
  }, [searchParams]);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'starred' | 'recent'>('all');
  
  const [qualityProjectId, setQualityProjectId] = useState<number | null>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');

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
    data: projectsList,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects({
    search: search || undefined,
    starred: projectFilter === 'starred' ? true : undefined,
  });

  const {
    data: templatesList,
    isLoading: templatesLoading,
    isError: templatesError,
    refetch: refetchTemplates,
  } = useTemplates();

  const deleteProjectMutation = useDeleteProject();
  const duplicateProjectMutation = useDuplicateProject();
  const starProjectMutation = useStarProject();
  const createTemplateMutation = useCreateTemplate();

  const projects = useMemo(() => {
    if (!projectsList) return [];
    if (projectFilter === 'recent') {
      return [...projectsList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
    return projectsList;
  }, [projectsList, projectFilter]);

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

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      useAuthStore.getState().setUser({
        ...user,
        name: editName,
        avatar_url: editAvatar,
      });
      setIsEditingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader onOpenSettings={() => setActiveTab('settings')} />

      <div className="mx-auto max-w-7xl px-6 pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 w-full max-w-md">
            <TabsTrigger value="projects" className="gap-2">
              <Folder className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layers className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* forceMount keeps form state when switching tabs */}
          <TabsContent value="projects" forceMount className="data-[state=inactive]:hidden">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <SearchBar onSearch={setSearch} />
                  <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                    {(['all', 'starred', 'recent'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setProjectFilter(filter)}
                        className={cn(
                          'rounded-md px-3 py-1 text-meta-sm font-medium capitalize',
                          projectFilter === filter
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={() => navigate('/new-project')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New project
                </Button>
              </div>

              {projectsError && (
                <ErrorBanner
                  message="Failed to load projects"
                  onRetry={() => refetchProjects()}
                />
              )}

              {projectsLoading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full" />
                  ))}
                </div>
              )}

              {!projectsLoading && !projectsError && projects.length === 0 && (
                <EmptyState
                  title="No projects found"
                  description={
                    search
                      ? 'No projects match your search.'
                      : 'Create documentation from your codebase.'
                  }
                  actionLabel="Create project"
                  onAction={() => navigate('/new-project')}
                />
              )}

              {!projectsLoading && !projectsError && projects.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                  {projects.map((proj) => (
                    <ProjectCard
                      key={proj.id}
                      project={proj}
                      onOpen={(id) => navigate(`/editor/${id}`)}
                      onDelete={(id) => {
                        if (window.confirm('Delete this project?')) {
                          deleteProjectMutation.mutate(id);
                        }
                      }}
                      onDuplicate={(id) => duplicateProjectMutation.mutate(id)}
                      onStar={(id, starred) => starProjectMutation.mutate({ id, starred })}
                      onQuality={(id) => setQualityProjectId(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates" forceMount className="data-[state=inactive]:hidden">
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
            </div>
          </TabsContent>

          <TabsContent value="settings" forceMount className="data-[state=inactive]:hidden">
            <div className="max-w-3xl space-y-6">
              <section className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-section font-semibold">Profile</h3>
                <p className="mt-1 text-meta text-muted-foreground">
                  Your account details
                </p>
                {!isEditingProfile ? (
                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={
                        user?.avatar_url ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.name}`
                      }
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{user?.name}</p>
                      <p className="text-meta text-muted-foreground">{user?.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditName(user?.name || '');
                        setEditAvatar(user?.avatar_url || '');
                        setIsEditingProfile(true);
                      }}
                    >
                      Edit profile
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-name">Name</Label>
                        <Input
                          id="profile-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-avatar">Avatar URL</Label>
                        <Input
                          id="profile-avatar"
                          value={editAvatar}
                          onChange={(e) => setEditAvatar(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-section font-semibold">Connected accounts</h3>
                <p className="mt-1 text-meta text-muted-foreground">
                  GitHub and GitLab for private repositories
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/git-connect')}
                >
                  <Icon name="github" className="mr-2 h-4 w-4" />
                  Manage Git connections
                </Button>
              </section>

              <AiProvidersSection />

              <section className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-section font-semibold">Security</h3>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-meta text-muted-foreground">Change your password</p>
                  <Button variant="outline" onClick={() => navigate('/reset-password')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Change password
                  </Button>
                </div>
              </section>

            </div>
          </TabsContent>
        </Tabs>
      </div>

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

      {qualityProjectId !== null && (
        <QualityModal
          projectId={qualityProjectId}
          open={true}
          onClose={() => setQualityProjectId(null)}
        />
      )}
    </div>
  );
};

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">{message}</span>
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
      <FolderOpen className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-4 text-section font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-meta text-muted-foreground">{description}</p>
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
