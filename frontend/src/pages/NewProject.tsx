import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';
import { useHasCapability } from '@/hooks/useHasCapability';
import { PROJECT_MANAGE } from '@/lib/authz';

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canCreateProject = useHasCapability(PROJECT_MANAGE);

  const canSubmit = canCreateProject && name.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const project = await projectsApi.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        source_type: 'scratch',
      });

      toast.success('Project created successfully');
      navigate(`/projects/${project.id}/source?setup=source`, { replace: true });
    } catch (err: unknown) {
      toast.error('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-workspace px-4">
      <Surface variant="panel" padding="lg" className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-interaction" />
            <h1 className="text-section font-semibold text-text-primary">New Project</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex items-center gap-1 text-meta text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {!canCreateProject ? (
          <p className="text-body text-text-secondary">Your role does not allow creating projects.</p>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payments Service, Frontend App"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc">Description (optional)</Label>
            <Input
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this project document?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/home')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
        )}
      </Surface>
    </div>
  );
};
