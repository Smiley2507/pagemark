import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization } from '../types';

interface OrgState {
  organizations: Organization[];
  activeOrgId: number | null;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrgId: (id: number | null) => void;
  getActiveOrg: () => Organization | undefined;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      activeOrgId: null,
      setOrganizations: (organizations) => {
        set({ organizations });
        // Auto-select personal org if active is null or no longer valid
        const { activeOrgId } = get();
        if (organizations.length > 0) {
          const isValid = organizations.some(o => o.id === activeOrgId);
          if (!activeOrgId || !isValid) {
            const personalOrg = organizations.find(o => o.personal);
            set({ activeOrgId: personalOrg ? personalOrg.id : organizations[0].id });
          }
        }
      },
      setActiveOrgId: (activeOrgId) => set({ activeOrgId }),
      getActiveOrg: () => {
        const { organizations, activeOrgId } = get();
        return organizations.find((o) => o.id === activeOrgId);
      },
    }),
    {
      name: 'pagemark-org-storage',
      partialize: (state) => ({ activeOrgId: state.activeOrgId }),
    }
  )
);
