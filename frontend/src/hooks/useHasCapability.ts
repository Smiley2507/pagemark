import { useOrgStore } from '../store/orgStore';
import { useAuthStore } from '../store/authStore';
import { hasCapability } from '../lib/authz';

/**
 * Whether the current user has the given capability in the active org,
 * optionally with a project-creator override (pass the resource's created_by).
 */
export function useHasCapability(capability: string, resource?: { created_by?: number }): boolean {
  const currentRole = useOrgStore((state) => state.currentRole);
  const userId = useAuthStore((state) => state.user?.id);
  return hasCapability(currentRole, capability, { createdBy: resource?.created_by, userId });
}
