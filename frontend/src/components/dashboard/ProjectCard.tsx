import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MoreVertical, Folder, Calendar, FileText, Trash2, Copy, BarChart2, ShieldCheck, Edit3 } from 'lucide-react';
import type { Project } from '../../types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onStar: (id: number, starred: boolean) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  onDuplicate,
  onStar,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleCardClick = () => {
    navigate(`/editor/${project.id}`);
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStar(project.id, !project.starred);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen((prev) => !prev);
  };

  // Status colors & labels
  const statusConfig = {
    pending: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
      label: 'Pending',
    },
    draft: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
      label: 'Draft',
    },
    finalized: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
      label: 'Finalized',
    },
  };

  const statusStyle = statusConfig[project.status] || statusConfig.pending;

  // Formatting date safely
  const getFormattedDate = () => {
    try {
      return formatDistanceToNow(new Date(project.updated_at), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/70 dark:hover:border-indigo-900/50 cursor-pointer backdrop-blur-sm"
      )}
    >
      {/* Dynamic top gradient line for premium aesthetic */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header section */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Folder className="h-5 w-5" />
            </div>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
              statusStyle.bg
            )}>
              {statusStyle.label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleStarClick}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-amber-500 dark:hover:bg-slate-800",
                project.starred && "text-amber-500 scale-110"
              )}
              title={project.starred ? "Unstar project" : "Star project"}
            >
              <Star className={cn("h-5 w-5", project.starred && "fill-amber-500")} />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleDropdownToggle}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 origin-top-right rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-lg ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-950 z-25 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      onOpen(project.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <Edit3 className="h-4.5 w-4.5 text-slate-400" />
                    Open Editor
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      navigate(`/analysis/${project.id}`);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <BarChart2 className="h-4.5 w-4.5 text-slate-400" />
                    Analysis
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      navigate(`/quality/${project.id}`);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <ShieldCheck className="h-4.5 w-4.5 text-slate-400" />
                    Quality Report
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      onDuplicate(project.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    <Copy className="h-4.5 w-4.5 text-slate-400" />
                    Duplicate
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-900" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      onDelete(project.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50/50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                  >
                    <Trash2 className="h-4.5 w-4.5 text-rose-500" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project details */}
        <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {project.name}
        </h3>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 h-10 leading-relaxed">
          {project.description || "No description provided."}
        </p>
      </div>

      {/* Footer section: Completion metrics and metadata */}
      <div className="mt-6 pt-5 border-t border-slate-100/80 dark:border-slate-800/80">
        {/* Completion Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Completion</span>
            <span className="text-indigo-600 dark:text-indigo-400">{project.completion_pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${project.completion_pct}%` }}
            />
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="font-medium">6 sections</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>Updated {getFormattedDate()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
