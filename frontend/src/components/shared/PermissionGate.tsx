import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOrgStore } from '@/store/orgStore';
import type { OrgMemberRole } from '@/types';

interface PermissionGateProps {
  children: React.ReactNode;
  allowedRoles: OrgMemberRole[];
  fallbackPath?: string;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  allowedRoles,
  fallbackPath = '/dashboard/projects',
}) => {
  const currentRole = useOrgStore((state) => state.currentRole);
  const location = useLocation();

  if (!currentRole) {
    // While role is loading, we can show a skeleton or just return null.
    // To avoid flashing, we might want a loading state in the store, but for now, we'll return null.
    return <div className="p-6 text-center text-muted-foreground">Loading permissions...</div>;
  }

  if (!allowedRoles.includes(currentRole)) {
    // Redirect to fallback path, preserving the intended destination for potential "Access Denied" toasts
    return <Navigate to={fallbackPath} replace state={{ from: location.pathname, error: 'Unauthorized' }} />;
  }

  return <>{children}</>;
};
