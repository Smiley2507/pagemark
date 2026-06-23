import React, { useRef, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SidebarNavigation } from './SidebarNavigation';
import { AppHeader } from './AppHeader';
import { NewProjectDialog } from '../workspace/NewProjectDialog';
import { WelcomeModal } from '../ui/welcome-modal';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';

export const MainLayout: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewProject = searchParams.get('new_project') === 'true';
  const showWelcome = useAuthStore((state) => state.showWelcome);
  const setShowWelcome = useAuthStore((state) => state.setShowWelcome);

  const { organizations, activeOrgId } = useOrgStore();
  const prevOrgIdRef = useRef(activeOrgId);
  const initialMountRef = useRef(true);
  const [switchingOrgName, setSwitchingOrgName] = useState<string | null>(null);
  const activeOrgName = organizations.find(o => o.id === activeOrgId)?.name;

  React.useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      prevOrgIdRef.current = activeOrgId;
      return;
    }
    const prevId = prevOrgIdRef.current;
    if (prevId !== null && activeOrgId !== null && prevId !== activeOrgId) {
      const name = activeOrgName || 'Organization';
      setSwitchingOrgName(name);
      const timer = setTimeout(() => setSwitchingOrgName(null), 1200);
      prevOrgIdRef.current = activeOrgId;
      return () => clearTimeout(timer);
    }
    prevOrgIdRef.current = activeOrgId;
  }, [activeOrgId, activeOrgName]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const updated = new URLSearchParams(searchParams);
      updated.delete('new_project');
      updated.delete('template_id');
      setSearchParams(updated);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-workspace text-text-primary">
      {switchingOrgName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xl transition-opacity duration-300">
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/80 p-10 shadow-2xl backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold text-text-primary">Switching to</p>
              <p className="mt-1 text-xl font-bold text-primary">{switchingOrgName}</p>
            </div>
          </div>
        </div>
      )}
      <SidebarNavigation />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <NewProjectDialog open={showNewProject} onOpenChange={handleOpenChange} />
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
};
