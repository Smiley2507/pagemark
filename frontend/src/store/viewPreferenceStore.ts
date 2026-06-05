import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'grid';

export type Surface = 
  | 'home-projects'
  | 'project-documents'
  | 'global-templates';

interface ViewPreference {
  surface: Surface;
  contextId?: string;
  viewMode: ViewMode;
}

interface RecentWork {
  projectId: number;
  documentId?: number;
  sectionId?: number;
  timestamp: string;
}

interface ViewPreferenceState {
  preferences: Record<string, ViewMode>;
  recentWork: RecentWork[];
  
  getViewMode: (surface: Surface, contextId?: string) => ViewMode;
  setViewMode: (surface: Surface, viewMode: ViewMode, contextId?: string) => void;
  
  recordRecentWork: (work: Omit<RecentWork, 'timestamp'>) => void;
  getRecentProjects: () => number[];
  getLastSection: (projectId: number, documentId: number) => number | undefined;
}

const makeKey = (surface: Surface, contextId?: string): string => {
  return contextId ? `${surface}:${contextId}` : surface;
};

export const useViewPreferenceStore = create<ViewPreferenceState>()(
  persist(
    (set, get) => ({
      preferences: {},
      recentWork: [],
      
      getViewMode: (surface, contextId) => {
        const key = makeKey(surface, contextId);
        return get().preferences[key] || 'list';
      },
      
      setViewMode: (surface, viewMode, contextId) => {
        const key = makeKey(surface, contextId);
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: viewMode,
          },
        }));
      },
      
      recordRecentWork: (work) => {
        set((state) => {
          // Remove existing entry for same project/document/section
          const filtered = state.recentWork.filter((w) => {
            if (work.sectionId && w.projectId === work.projectId && w.documentId === work.documentId) {
              return false;
            }
            if (work.documentId && w.projectId === work.projectId && !work.sectionId) {
              return false;
            }
            if (!work.documentId && w.projectId === work.projectId) {
              return false;
            }
            return true;
          });
          
          // Add new entry at the beginning
          const newWork: RecentWork = {
            ...work,
            timestamp: new Date().toISOString(),
          };
          
          // Keep only last 50 entries
          return {
            recentWork: [newWork, ...filtered].slice(0, 50),
          };
        });
      },
      
      getRecentProjects: () => {
        const { recentWork } = get();
        const projectIds = new Set<number>();
        
        recentWork.forEach((work) => {
          projectIds.add(work.projectId);
        });
        
        return Array.from(projectIds);
      },
      
      getLastSection: (projectId, documentId) => {
        const { recentWork } = get();
        const entry = recentWork.find(
          (w) => w.projectId === projectId && w.documentId === documentId && w.sectionId
        );
        return entry?.sectionId;
      },
    }),
    {
      name: 'pagemark-view-preferences',
    }
  )
);
