import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Star,
  MoreHorizontal,
  Clock,
  AlertCircle,
  Check,
  Trash2,
  Copy,
  BarChart2,
  ShieldCheck,
  Edit3,
  Tags,
  X,
  Pencil,
  FileText,
} from 'lucide-react';
import type { Project } from '../../types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { projectsApi } from '@/api/projects';
import { toast } from 'sonner';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onStar: (id: number, starred: boolean) => void;
  onQuality?: (id: number) => void;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    dot: 'bg-muted-foreground',
    pill: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
  draft: {
    label: 'Draft',
    dot: 'bg-status-draft-foreground',
    pill: 'bg-status-draft text-status-draft-foreground',
    icon: AlertCircle,
  },
  finalized: {
    label: 'Finalized',
    dot: 'bg-status-finalized-foreground',
    pill: 'bg-status-finalized text-status-finalized-foreground',
    icon: Check,
  },
} as const;

const TAG_PRESETS = ['academic', 'frontend', 'api', 'backend', 'mobile', 'devops', 'design', 'data'];

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  onDuplicate,
  onStar,
  onQuality,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(project.tags || []);
  const [tagInput, setTagInput] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [descModalOpen, setDescModalOpen] = useState(false);
  const [descDraft, setDescDraft] = useState(project.description ?? '');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) =>
      projectsApi.updateProject(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  useEffect(() => {
    setNameDraft(project.name);
  }, [project.name]);

  useEffect(() => {
    setDescDraft(project.description ?? '');
  }, [project.description]);

  useEffect(() => {
    if (renaming && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [renaming]);

  const handleRenameSubmit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== project.name) {
      updateMutation.mutate({ name: trimmed });
    } else {
      setNameDraft(project.name);
    }
    setRenaming(false);
  };

  const handleDescSave = () => {
    updateMutation.mutate({ description: descDraft });
    setDescModalOpen(false);
  };
  const status = statusConfig[project.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    setTags(project.tags || []);
  }, [project.tags]);

  const addTag = (t: string) => {
    const trimmed = t.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(tag => tag !== t));
  };

  const saveTags = async () => {
    try {
      await projectsApi.updateProject(project.id, { tags } as any);
      toast.success('Tags updated');
      setTagModalOpen(false);
    } catch (e) {
      toast.error('Failed to update tags');
    }
  };

  const updatedLabel = (() => {
    try {
      return formatDistanceToNow(new Date(project.updated_at), { addSuffix: true });
    } catch {
      return 'recently';
    }
  })();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/editor/${project.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/editor/${project.id}`)}
        className="group relative cursor-pointer rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-sm"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar(project.id, !project.starred);
          }}
          className={cn(
            'absolute right-10 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent',
            project.starred && 'text-status-draft-foreground'
          )}
          aria-label={project.starred ? 'Unstar project' : 'Star project'}
        >
          <Star className={cn('h-4 w-4', project.starred && 'fill-status-draft-foreground')} />
        </button>

        <div className="flex items-start justify-between gap-2 pr-16">
          {renaming ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setNameDraft(project.name);
                  setRenaming(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-8 rounded border border-border bg-background px-2 text-section font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"
            />
          ) : (
            <h3 className="text-section font-semibold text-foreground">{project.name}</h3>
          )}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((p) => !p);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label="Project actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {dropdownOpen && (
              <div
                className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MenuItem icon={Edit3} label="Open editor" onClick={() => { setDropdownOpen(false); onOpen(project.id); }} />
                <MenuItem icon={Pencil} label="Rename" onClick={() => { setDropdownOpen(false); setRenaming(true); }} />
                <MenuItem icon={FileText} label="Edit description" onClick={() => { setDropdownOpen(false); setDescModalOpen(true); }} />
                <MenuItem icon={Tags} label="Edit Tags" onClick={() => { setDropdownOpen(false); setTagModalOpen(true); }} />
                <MenuItem icon={BarChart2} label="Analysis" onClick={() => { setDropdownOpen(false); navigate(`/analysis/${project.id}`); }} />
                {onQuality && <MenuItem icon={ShieldCheck} label="Quality" onClick={() => { setDropdownOpen(false); onQuality(project.id); }} />}
                <MenuItem icon={Copy} label="Duplicate" onClick={() => { setDropdownOpen(false); onDuplicate(project.id); }} />
                <div className="my-1 h-px bg-border" />
                <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setDropdownOpen(false); onDelete(project.id); }} />
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 line-clamp-2 text-meta text-muted-foreground">
          {project.description || 'No description provided.'}
        </p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${project.completion_pct}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-meta text-muted-foreground">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-meta-sm font-medium',
              status.pill
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden />
            <StatusIcon className="h-3 w-3" aria-hidden />
            {status.label}
          </span>
          <span>Updated {updatedLabel}</span>
        </div>
      </div>

      {/* Description Edit Modal */}
      {descModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDescModalOpen(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Description</h3>
              <button onClick={() => setDescModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="Describe your project..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none h-24 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDescModalOpen(false)}>Cancel</Button>
              <Button onClick={handleDescSave}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Edit Modal */}
      {tagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagModalOpen(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Tags</h3>
              <button onClick={() => setTagModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-sm px-3 py-1 font-medium">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 mb-3">
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Add a tag..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <Button onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</Button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TAG_PRESETS.filter(t => !tags.includes(t)).map(preset => (
                <button
                  key={preset}
                  onClick={() => addTag(preset)}
                  className="rounded-full bg-muted text-muted-foreground text-xs px-2.5 py-1 hover:bg-accent hover:text-foreground transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTagModalOpen(false)}>Cancel</Button>
              <Button onClick={saveTags}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-body hover:bg-accent',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

