import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { GitBranch, Hash, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { projectsApi } from '@/api/projects';

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [tagDraft, setTagDraft] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });

  const tags = useMemo(() => project?.tags || [], [project?.tags]);
  const updateProject = useMutation({
    mutationFn: (nextTags: string[]) => projectsApi.updateProject(Number(projectId), { tags: nextTags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (!project) {
    return (
      <Surface variant="muted" padding="lg">
        <p className="text-body text-text-secondary">Loading Project settings...</p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <h2 className="text-section font-semibold text-text-primary">Tags</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => updateProject.mutate(tags.filter((candidate) => candidate !== tag))}
              aria-label={`Remove ${tag} tag`}
            >
              <Badge variant="neutral" showIcon={false}>{tag}</Badge>
            </button>
          ))}
          {tags.length === 0 && <p className="text-body text-text-muted">No Project tags.</p>}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTag = tagDraft.trim();
            if (nextTag && !tags.includes(nextTag)) {
              updateProject.mutate([...tags, nextTag]);
              setTagDraft('');
            }
          }}
        >
          <Input
            aria-label="Add Project tag"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            placeholder="Add tag"
          />
          <Button type="submit" disabled={!tagDraft.trim() || updateProject.isPending}>
            <Save className="h-4 w-4" />
            Add
          </Button>
        </form>
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <h2 className="text-section font-semibold text-text-primary">Source Defaults</h2>
        </div>
        <div className="grid gap-3 text-body text-text-secondary">
          <div className="flex items-center justify-between gap-4">
            <span>Source type</span>
            <Badge variant="neutral" showIcon={false}>{project.source_type}</Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Branch</span>
            <span className="text-text-primary">{project.selected_branch || 'Not connected'}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Repository</span>
            <span className="truncate text-text-primary">
              {project.source_repository || (project.source_metadata?.repo_url as string) || 'Not connected'}
            </span>
          </div>
        </div>
      </Surface>
    </div>
  );
}
