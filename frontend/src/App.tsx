import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { useAuthStore } from './store/authStore';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { Analysis } from './pages/Analysis';
import { GitConnectPage } from './pages/GitConnectPage';
import { useMe } from './hooks/useAuth';
import { TemplatesView } from './components/dashboard';
import { SettingsPage } from './pages/SettingsPage';
import { NLPDashboard } from './pages/NLPDashboard';
import { ExportPage } from './pages/ExportPage';
import { DocumentSetupPage } from './pages/DocumentSetupPage';
import { HomePage } from './pages/HomePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage';
import { DocumentLibraryPage } from './pages/DocumentLibraryPage';
import { ProjectSourcePage } from './pages/ProjectSourcePage';
import { ProjectActivityPage } from './pages/ProjectActivityPage';
import { DocumentEditorPage } from './pages/DocumentEditorPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';

const queryClient = new QueryClient();

import { VerifyEmailPendingPage } from './pages/auth/VerifyEmailPendingPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { OrgInvitePage } from './pages/auth/OrgInvitePage';
import { useOrgStore } from './store/orgStore';
import { orgApi } from './api/org';
import { MainLayout } from './components/layout/MainLayout';

const RootRedirect = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <LandingPage />;
  if (!user.is_verified) return <Navigate to="/verify-email-pending" replace />;
  return <Navigate to="/home" replace />;
};

const EditorLegacyRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/projects/${id}`} replace />;
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
        {/* Full-screen routes (no sidebar/header) */}
        <Route path="/editor/:id" element={<EditorLegacyRedirect />} />
        <Route path="/export/:projectId" element={<ExportPage />} />
        <Route path="/document-setup" element={<DocumentSetupPage />} />
        <Route path="/projects/:projectId/documents/:documentId" element={<DocumentEditorPage />} />

        {/* Main application routes */}
        <Route element={<MainLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/templates" element={<TemplatesView />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/new-project" element={<Navigate to="/home?new_project=true" replace />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/nlp/:projectId" element={<NLPDashboard />} />
          <Route path="/git-connect" element={<GitConnectPage />} />
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          <Route path="/dashboard/templates" element={<Navigate to="/templates" replace />} />
          <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
          
          {/* Project Workspace */}
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />}>
            <Route index element={<DocumentLibraryPage />} />
            <Route path="source" element={<ProjectSourcePage />} />
            <Route path="activity" element={<ProjectActivityPage />} />
            <Route path="settings" element={<ProjectSettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Invite: accept org invitation */}
      <Route path="/org/invite/:token" element={<OrgInvitePage />} />

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
