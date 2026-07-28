import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminStore } from '@/store/adminStore';
import { adminApi, setAdminToken, clearAdminToken } from '@/api/admin';

export function AdminGuard() {
  const { token, isExpired, clearSession, touchActivity } = useAdminStore();
  const location = useLocation();
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }

    if (isExpired()) {
      clearSession();
      clearAdminToken();
      setValidating(false);
      return;
    }

    setAdminToken(token);

    adminApi.me()
      .then(() => {
        touchActivity();
        setValidating(false);
      })
      .catch(() => {
        clearSession();
        clearAdminToken();
        setValidating(false);
      });
  }, [token]);

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!token || isExpired()) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
