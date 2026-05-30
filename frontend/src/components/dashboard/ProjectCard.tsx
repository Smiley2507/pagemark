import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import type { Project } from '../../types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  onDuplicate,
  onStar,
  onQuality,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  const updatedLabel = (() => {
    try {
      return formatDistanceToNow(new Date(project.updated_at), { addSuffix: true });
    } catch {
      return 'recently';
    }
  })();

  return (
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
        <h3 className="text-section font-semibold text-foreground">{project.name}</h3>
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
              <MenuItem icon={BarChart2} label="Analysis" onClick={() => { setDropdownOpen(false); navigate(`/analysis/${project.id}`); }} />
              {onQuality && <MenuItem icon={ShieldCheck} label="Quality" onClick={() => { setDropdownOpen(false); onQuality(project.id); }} />}
              <MenuItem icon={Copy} label="Duplicate" onClick={() => { setDropdownOpen(false); onDuplicate(project.id); }} />
              <div className="my-1 h-px bg-border" />
              <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setDropdownOpen(false); onDelete(project.id); }} />
            </div>
          )}
        </div>
      </div>

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
