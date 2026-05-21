import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  Layers,
  Settings,
  Plus,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  Laptop,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  UserCheck,
  CheckCircle,
  Lock,
  PlusCircle,
  Trash2,
  ExternalLink
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useLogout } from '../hooks/useAuth';
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useDuplicateProject,
  useStarProject,
  useTemplates,
  useCreateTemplate,
} from '../hooks/useProjects';

import { ProjectCard } from '../components/dashboard/ProjectCard';
import { TemplateCard } from '../components/dashboard/TemplateCard';
import { SearchBar } from '../components/dashboard/SearchBar';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';

import type { Template } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();
  const logoutMutation = useLogout();

  // Active Tab: 'projects' | 'templates' | 'settings'
  const [activeTab, setActiveTab] = useState<'projects' | 'templates' | 'settings'>('projects');

  // Projects Filters & Search State
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'starred' | 'recent'>('all');

  // React Query Hooks for Projects
  const {
    data: projectsList,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useProjects({
    search: search || undefined,
    starred: projectFilter === 'starred' ? true : undefined,
  });

  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const duplicateProjectMutation = useDuplicateProject();
  const starProjectMutation = useStarProject();

  // React Query Hooks for Templates
  const {
    data: templatesList,
    isLoading: templatesLoading,
    isError: templatesError,
    refetch: refetchTemplates,
  } = useTemplates();

  const createTemplateMutation = useCreateTemplate();

  // Avatar / Profile local edit state (simulating API updates)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');

  // Custom Template Creation Modal State
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

  // Dropdowns/Profile menu open states
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  // Sorting for 'recent' filter on client side
  const projects = React.useMemo(() => {
    if (!projectsList) return [];
    if (projectFilter === 'recent') {
      return [...projectsList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
    return projectsList;
  }, [projectsList, projectFilter]);

  // Actions
  const handleOpenProject = (id: number) => {
    navigate(`/editor/${id}`);
  };

  const handleDeleteProject = (id: number) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      deleteProjectMutation.mutate(id);
    }
  };

  const handleDuplicateProject = (id: number) => {
    duplicateProjectMutation.mutate(id);
  };

  const handleStarProject = (id: number, starred: boolean) => {
    starProjectMutation.mutate({ id, starred });
  };

  const handleUseTemplate = (template: Template) => {
    // Navigate to /new-project and pre-select this template
    navigate(`/new-project?template_id=${template.id}`);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    await createTemplateMutation.mutateAsync({
      name: newTemplateName,
      description: newTemplateDesc,
      category: newTemplateCategory,
      sections_json: newTemplateSections,
    });

    // Reset and close
    setNewTemplateName('');
    setNewTemplateDesc('');
    setNewTemplateCategory('Technical');
    setNewTemplateSections(['Overview', 'Architecture', 'Implementation']);
    setIsTemplateModalOpen(false);
  };

  const addCustomSection = () => {
    if (customSectionInput.trim()) {
      setNewTemplateSections((prev) => [...prev, customSectionInput.trim()]);
      setCustomSectionInput('');
    }
  };

  const removeCustomSection = (index: number) => {
    setNewTemplateSections((prev) => prev.filter((_, i) => i !== index));
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
    <div className="min-h-screen bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-md shadow-indigo-500/10">
              <span className="text-xl font-black text-white">P</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 bg-clip-text text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
              Pagemark<span className="text-indigo-500 font-black">.</span>
            </span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-4">
            
            {/* Theme Toggle Dropdown */}
            <div className="relative">
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                onBlur={() => setTimeout(() => setThemeMenuOpen(false), 200)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70"
              >
                {theme === 'light' && <Sun className="h-5 w-5 text-amber-500" />}
                {theme === 'dark' && <Moon className="h-5 w-5 text-indigo-400" />}
                {theme === 'system' && <Laptop className="h-5 w-5" />}
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-950 z-50">
                  <button
                    onClick={() => setTheme('light')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <Sun className="h-4 w-4 text-amber-500" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <Moon className="h-4 w-4 text-indigo-400" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <Laptop className="h-4 w-4" />
                    System
                  </button>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                onBlur={() => setTimeout(() => setProfileMenuOpen(false), 200)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/50 p-1.5 pr-3 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/70"
              >
                <img
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.name || 'pagemark'}`}
                  alt="Avatar"
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/10"
                />
                <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-300 sm:inline-block">
                  {user?.name}
                </span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-950 z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Signed in as <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user?.email}</div>
                  </div>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-900" />
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      logoutMutation.mutate();
                      setProfileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 hover:bg-rose-50/50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                  >
                    <LogOut className="h-4.5 w-4.5 text-rose-500" />
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ── MAIN DASHBOARD CONTAINER ──────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto gap-8">
          <button
            onClick={() => setActiveTab('projects')}
            className={cn(
              "flex items-center gap-2 pb-4 text-sm font-semibold tracking-wide transition-all border-b-2 px-1 focus:outline-none whitespace-nowrap",
              activeTab === 'projects'
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            <Folder className="h-4.5 w-4.5" />
            Projects
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={cn(
              "flex items-center gap-2 pb-4 text-sm font-semibold tracking-wide transition-all border-b-2 px-1 focus:outline-none whitespace-nowrap",
              activeTab === 'templates'
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            <Layers className="h-4.5 w-4.5" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-2 pb-4 text-sm font-semibold tracking-wide transition-all border-b-2 px-1 focus:outline-none whitespace-nowrap",
              activeTab === 'settings'
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
          >
            <Settings className="h-4.5 w-4.5" />
            Settings
          </button>
        </div>

        {/* ── PROJECTS TAB ─────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            
            {/* Action Bar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              
              {/* Search + Filter group */}
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <SearchBar onSearch={setSearch} />
                
                {/* Filter buttons */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/60 max-w-fit border border-slate-200/50 dark:border-slate-800/40">
                  {(['all', 'starred', 'recent'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setProjectFilter(filter)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                        projectFilter === filter
                          ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-850 dark:text-indigo-400"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA Create */}
              <Button
                onClick={() => navigate('/new-project')}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-500/20"
              >
                <Plus className="h-4.5 w-4.5" />
                New Project
              </Button>
            </div>

            {/* Error State */}
            {projectsError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 dark:border-rose-950/30 dark:bg-rose-950/15">
                <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                  <div>
                    <h4 className="font-bold">Failed to load projects</h4>
                    <p className="text-sm text-rose-600/80 dark:text-rose-400/80">Please check your network connection and try again.</p>
                  </div>
                </div>
                <Button
                  onClick={() => refetchProjects()}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Loading
                </Button>
              </div>
            )}

            {/* Loading skeletons */}
            {projectsLoading && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200/60 p-6 dark:border-slate-800/60 space-y-4">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-9 w-9 rounded-xl" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                    <div className="space-y-2 pt-4">
                      <Skeleton className="h-3 w-1/4 rounded-md" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <div className="flex justify-between pt-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!projectsLoading && !projectsError && projects.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-slate-200 bg-white/40 dark:border-slate-800 dark:bg-slate-900/30 backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400 mb-4">
                  <FolderOpen className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  No projects found
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  {search
                    ? "We couldn't find any projects matching your search filter."
                    : "Get started by generating premium documentation for your codebase."}
                </p>
                <Button
                  onClick={() => navigate('/new-project')}
                  className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-indigo-500 dark:hover:text-white"
                >
                  <span>Create your first project</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Grid of Projects */}
            {!projectsLoading && !projectsError && projects.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((proj) => (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    onOpen={handleOpenProject}
                    onDelete={handleDeleteProject}
                    onDuplicate={handleDuplicateProject}
                    onStar={handleStarProject}
                  />
                ))}
              </div>
            )}

          </div>
        )}

        {/* ── TEMPLATES TAB ────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            
            {/* Header + Create action */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Available Outlines</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pick a pre-configured outline layout or craft your custom blueprint.</p>
              </div>

              <Button
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-sm hover:shadow-indigo-500/20"
              >
                <PlusCircle className="h-4.5 w-4.5" />
                Create Template
              </Button>
            </div>

            {/* Error State */}
            {templatesError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 dark:border-rose-950/30 dark:bg-rose-950/15">
                <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                  <div>
                    <h4 className="font-bold">Failed to load templates</h4>
                    <p className="text-sm text-rose-600/80 dark:text-rose-400/80">Could not retrieve built-in templates.</p>
                  </div>
                </div>
                <Button onClick={() => refetchTemplates()} className="mt-4 rounded-xl bg-rose-600">
                  Retry Loading
                </Button>
              </div>
            )}

            {/* Loading Grid */}
            {templatesLoading && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200/65 p-6 dark:border-slate-800/65 space-y-4">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                    <Skeleton className="h-10 w-full rounded-xl pt-4" />
                  </div>
                ))}
              </div>
            )}

            {/* Templates list grid */}
            {!templatesLoading && !templatesError && templatesList && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {templatesList.map((tmpl) => (
                  <TemplateCard
                    key={tmpl.id}
                    template={tmpl}
                    onUse={handleUseTemplate}
                  />
                ))}
              </div>
            )}

            {/* Create Custom Template Modal Dialog */}
            {isTemplateModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden animate-scale-up">
                  
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-900">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Custom Outline Template</h3>
                    <button
                      onClick={() => setIsTemplateModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateTemplate} className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="tmpl-name">Template Name</Label>
                      <Input
                        id="tmpl-name"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g., Microservice Spec"
                        required
                        className="mt-1 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tmpl-desc">Description</Label>
                      <Input
                        id="tmpl-desc"
                        value={newTemplateDesc}
                        onChange={(e) => setNewTemplateDesc(e.target.value)}
                        placeholder="Description of structure"
                        className="mt-1 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tmpl-cat">Category</Label>
                      <select
                        id="tmpl-cat"
                        value={newTemplateCategory}
                        onChange={(e) => setNewTemplateCategory(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        <option>Technical</option>
                        <option>Developer</option>
                        <option>Product</option>
                        <option>Custom</option>
                      </select>
                    </div>

                    {/* Dynamic list of sections */}
                    <div className="space-y-2">
                      <Label>Outline Sections</Label>
                      <div className="flex gap-2">
                        <Input
                          value={customSectionInput}
                          onChange={(e) => setCustomSectionInput(e.target.value)}
                          placeholder="Add heading..."
                          className="rounded-xl flex-1"
                        />
                        <Button
                          type="button"
                          onClick={addCustomSection}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                        >
                          Add
                        </Button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50/50 dark:border-slate-900 dark:bg-slate-900/30">
                        {newTemplateSections.map((sec, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900/30 dark:bg-indigo-950/20 dark:text-indigo-400"
                          >
                            <span>{sec}</span>
                            <button
                              type="button"
                              onClick={() => removeCustomSection(idx)}
                              className="text-indigo-400 hover:text-indigo-600 font-bold ml-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-900">
                      <Button
                        type="button"
                        onClick={() => setIsTemplateModalOpen(false)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl"
                      >
                        Create Blueprint
                      </Button>
                    </div>

                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── SETTINGS TAB ─────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-8 max-w-3xl">
            
            {/* 1. Profile Section */}
            <section className="bg-white/60 p-6 rounded-2xl border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <UserIcon className="h-5 w-5 text-indigo-500" />
                Profile Settings
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage public profile settings and configurations.</p>
              
              {!isEditingProfile ? (
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
                  <img
                    src={user?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.name || 'pagemark'}`}
                    alt="Avatar"
                    className="h-20 w-20 rounded-2xl object-cover ring-4 ring-indigo-500/10"
                  />
                  <div className="space-y-1 text-center sm:text-left flex-1">
                    <h4 className="text-lg font-extrabold">{user?.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{user?.email}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 mt-2">
                      <UserCheck className="h-3.5 w-3.5" />
                      Active Session
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setEditName(user?.name || '');
                      setEditAvatar(user?.avatar_url || '');
                      setIsEditingProfile(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70"
                  >
                    Edit Profile
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="profile-name">Full Name</Label>
                      <Input
                        id="profile-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="mt-1.5 rounded-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="profile-avatar">Avatar URL</Label>
                      <Input
                        id="profile-avatar"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value)}
                        placeholder="https://..."
                        className="mt-1.5 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}
            </section>

            {/* 2. Appearance Section */}
            <section className="bg-white/60 p-6 rounded-2xl border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Sun className="h-5 w-5 text-indigo-500" />
                Appearance
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select your preferred color theme preference.</p>
              
              <div className="mt-6 grid grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={cn(
                      "flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all focus:outline-none uppercase text-xs font-bold tracking-wider",
                      theme === mode
                        ? "border-indigo-500 bg-indigo-50/30 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 shadow-sm"
                        : "border-slate-200 bg-white/50 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-800/70"
                    )}
                  >
                    {mode === 'light' && <Sun className="h-5 w-5 text-amber-500" />}
                    {mode === 'dark' && <Moon className="h-5 w-5 text-indigo-400" />}
                    {mode === 'system' && <Laptop className="h-5 w-5" />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Security Section */}
            <section className="bg-white/60 p-6 rounded-2xl border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Lock className="h-5 w-5 text-indigo-500" />
                Security Settings
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Maintain your credentials and account password.</p>
              
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Account Password</h4>
                  <p className="text-xs text-slate-500">Regularly update your password to keep your assets secure.</p>
                </div>
                
                <Button
                  onClick={() => navigate('/reset-password')}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 flex items-center gap-1.5"
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </Button>
              </div>
            </section>

          </div>
        )}

      </main>
    </div>
  );
};
