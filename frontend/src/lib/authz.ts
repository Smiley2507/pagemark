/**
 * Mirrors backend/app/authz.py — the org-role capability hierarchy.
 * VIEWER < TECHNICAL_WRITER < DEVELOPER < PROJECT_MANAGER < ADMIN.
 */
import type { OrgMemberRole } from '../types';

export const PROJECT_READ = 'project.read';
export const CONTENT_COMMENT = 'content.comment';
export const CONTENT_WRITE = 'content.write';
export const DOCUMENT_MANAGE = 'document.manage';
export const CONTENT_REVIEW = 'content.review';
export const PROJECT_MANAGE = 'project.manage';
export const ORG_AUDIT = 'org.audit';
export const ORG_MANAGE = 'org.manage';

export const ROLE_RANK: Record<OrgMemberRole, number> = {
  VIEWER: 0,
  TECHNICAL_WRITER: 1,
  DEVELOPER: 2,
  PROJECT_MANAGER: 3,
  ADMIN: 4,
};

export const CAPABILITY_MIN_RANK: Record<string, number> = {
  [PROJECT_READ]: 0,
  [CONTENT_COMMENT]: 1,
  [CONTENT_WRITE]: 1,
  [DOCUMENT_MANAGE]: 1,
  [CONTENT_REVIEW]: 1,
  [PROJECT_MANAGE]: 2,
  [ORG_AUDIT]: 3,
  [ORG_MANAGE]: 4,
};

export interface CapabilityOverride {
  createdBy?: number;
  userId?: number;
}

/**
 * A project's creator gets every capability at or below project.manage's rank,
 * regardless of org role — never org.audit/org.manage (no project context).
 */
export function hasCapability(
  role: OrgMemberRole | null,
  capability: string,
  opts?: CapabilityOverride
): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (
    opts?.createdBy != null &&
    opts?.userId != null &&
    opts.createdBy === opts.userId &&
    CAPABILITY_MIN_RANK[capability] <= CAPABILITY_MIN_RANK[PROJECT_MANAGE]
  ) {
    return true;
  }
  return ROLE_RANK[role] >= CAPABILITY_MIN_RANK[capability];
}
