import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { projectsApi } from '@/api/projects';
import { useHasCapability } from '@/hooks/useHasCapability';
import { PROJECT_MANAGE } from '@/lib/authz';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template_id');
  const canCreateProject = useHasCapability(PROJECT_MANAGE);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      onOpenChange(false);
      
      // Reset state
      setName('');
      setDescription('');

      const dest = templateId 
        ? `/projects/${project.id}/source?setup=source&templateId=${templateId}`
        : `/projects/${project.id}/source?setup=source`;
      navigate(dest);
    } catch (err: unknown) {
      toast.error('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-interaction" />
            <DialogTitle>New Project</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Create a new Project container workspace.
          </DialogDescription>
        </DialogHeader>

        {!canCreateProject ? (
          <p className="text-body text-text-secondary">Your role does not allow creating projects.</p>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dlg-project-name">Project name</Label>
            <Input
              id="dlg-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payments Service, Frontend App"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dlg-project-desc">Description (optional)</Label>
            <Input
              id="dlg-project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this project document?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
};
