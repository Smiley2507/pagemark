import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, OrgMemberRole } from '../types';

interface OrgState {
  organizations: Organization[];
  activeOrgId: number | null;
  currentRole: OrgMemberRole | null;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrgId: (id: number | null) => void;
  setCurrentRole: (role: OrgMemberRole | null) => void;
  getActiveOrg: () => Organization | undefined;
  switchOrganization: (orgId: number) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      activeOrgId: null,
      currentRole: null,
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
      setCurrentRole: (currentRole) => set({ currentRole }),
      getActiveOrg: () => {
        const { organizations, activeOrgId } = get();
        return organizations.find((o) => o.id === activeOrgId);
      },
      switchOrganization: (orgId) => {
        set({ activeOrgId: orgId, currentRole: null });
      },
    }),
    {
      name: 'pagemark-org-storage',
      partialize: (state) => ({ activeOrgId: state.activeOrgId }),
    }
  )
);
