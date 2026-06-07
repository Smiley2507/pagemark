import React from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { SidebarNavigation } from './SidebarNavigation';
import { AppHeader } from './AppHeader';
import { NewProjectDialog } from '../workspace/NewProjectDialog';

export const MainLayout: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const showNewProject = searchParams.get('new_project') === 'true';

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
      <SidebarNavigation />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <NewProjectDialog open={showNewProject} onOpenChange={handleOpenChange} />
    </div>
  );
};
