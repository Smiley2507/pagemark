import { describe, it, expect } from 'vitest';
import type { OrgMemberRole } from '../types';
import {
  hasCapability,
  ROLE_RANK,
  CAPABILITY_MIN_RANK,
  PROJECT_READ,
  CONTENT_COMMENT,
  CONTENT_WRITE,
  DOCUMENT_MANAGE,
  CONTENT_REVIEW,
  PROJECT_MANAGE,
  ORG_AUDIT,
  ORG_MANAGE,
} from './authz';

const ALL_ROLES: OrgMemberRole[] = ['VIEWER', 'TECHNICAL_WRITER', 'DEVELOPER', 'PROJECT_MANAGER', 'ADMIN'];
const ALL_CAPABILITIES = [
  PROJECT_READ,
  CONTENT_COMMENT,
  CONTENT_WRITE,
  DOCUMENT_MANAGE,
  CONTENT_REVIEW,
  PROJECT_MANAGE,
  ORG_AUDIT,
  ORG_MANAGE,
];

describe('hasCapability', () => {
  it('matches the role-rank hierarchy for every role x capability pair', () => {
    for (const role of ALL_ROLES) {
      for (const capability of ALL_CAPABILITIES) {
        const expected = ROLE_RANK[role] >= CAPABILITY_MIN_RANK[capability];
        expect(hasCapability(role, capability)).toBe(expected);
      }
    }
  });

  it('denies everything for a null role', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(hasCapability(null, capability)).toBe(false);
    }
  });

  it('grants a project creator with VIEWER role project.manage and everything below it', () => {
    const opts = { createdBy: 42, userId: 42 };
    for (const capability of [PROJECT_READ, CONTENT_COMMENT, CONTENT_WRITE, DOCUMENT_MANAGE, CONTENT_REVIEW, PROJECT_MANAGE]) {
      expect(hasCapability('VIEWER', capability, opts)).toBe(true);
    }
    for (const capability of [ORG_AUDIT, ORG_MANAGE]) {
      expect(hasCapability('VIEWER', capability, opts)).toBe(false);
    }
  });

  it('ignores the creator override when createdBy does not match userId', () => {
    const opts = { createdBy: 42, userId: 99 };
    expect(hasCapability('VIEWER', PROJECT_MANAGE, opts)).toBe(false);
  });

  it('ADMIN always passes regardless of creator status', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(hasCapability('ADMIN', capability)).toBe(true);
    }
  });
});
