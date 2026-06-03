import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { useAuthStore } from './store/authStore';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { Dashboard } from './pages/Dashboard';
import { NewProject } from './pages/NewProject';
import { Editor } from './pages/Editor';
import { Analysis } from './pages/Analysis';
import { GitConnectPage } from './pages/GitConnectPage';
import { useMe } from './hooks/useAuth';
import { ProjectsView, TemplatesView } from './components/dashboard';
import { OrgMembersView, OrgAuditLogView, OrgApiKeysView, OrgSettingsView } from './components/org';

const queryClient = new QueryClient();

import { VerifyEmailPendingPage } from './pages/auth/VerifyEmailPendingPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { useOrgStore } from './store/orgStore';
import { orgApi } from './api/org';
import { MainLayout } from './components/layout/MainLayout';
import { PermissionGate } from './components/shared/PermissionGate';

const RootRedirect = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_verified) return <Navigate to="/verify-email-pending" replace />;
  return <Navigate to="/dashboard" replace />;
};

const AppRoutes = () => {
  const { isLoading } = useMe();
  const user = useAuthStore((state) => state.user);
  const { setOrganizations, activeOrgId, setCurrentRole } = useOrgStore();

  React.useEffect(() => {
    if (user && user.is_verified) {
      orgApi.listOrganizations().then(setOrganizations).catch(console.error);
    }
  }, [user, setOrganizations]);

  React.useEffect(() => {
    if (user && activeOrgId) {
      orgApi.listMembers(activeOrgId)
        .then((members) => {
          const me = members.find((m) => m.user_id === user.id);
          if (me) {
            setCurrentRole(me.role);
          }
        })
        .catch((err) => console.error('Failed to fetch org role:', err));
    }
  }, [user, activeOrgId, setCurrentRole]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-meta text-muted-foreground">Loading session…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-email-pending" element={<VerifyEmailPendingPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<Navigate to="projects" replace />} />
            <Route path="projects" element={<ProjectsView />} />
            <Route path="templates" element={<TemplatesView />} />
            <Route path="members" element={
              <PermissionGate allowedRoles={['ADMIN', 'PROJECT_MANAGER']}>
                <OrgMembersView />
              </PermissionGate>
            } />
            <Route path="activity" element={
              <PermissionGate allowedRoles={['ADMIN', 'PROJECT_MANAGER']}>
                <OrgAuditLogView />
              </PermissionGate>
            } />
            <Route path="keys" element={
              <PermissionGate allowedRoles={['ADMIN', 'PROJECT_MANAGER']}>
                <OrgApiKeysView />
              </PermissionGate>
            } />
            <Route path="settings" element={
              <PermissionGate allowedRoles={['ADMIN']}>
                <OrgSettingsView />
              </PermissionGate>
            } />
          </Route>
          <Route path="/new-project" element={<NewProject />} />
          <Route path="/editor/:id" element={<Editor />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/git-connect" element={<GitConnectPage />} />
        </Route>
      </Route>

      {/* Root: redirect based on auth state */}
      <Route path="/" element={<RootRedirect />} />

      {/* Catch-all: redirect unknown paths to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

import { useThemeStore, applyTheme } from './store/themeStore';

function App() {
  React.useEffect(() => {
    const currentTheme = useThemeStore.getState().theme;
    applyTheme(currentTheme);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (useThemeStore.getState().theme === 'system') {
        applyTheme('system');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
