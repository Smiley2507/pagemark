import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiveblocksProvider } from '@liveblocks/react/suspense';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { useAuthStore } from './store/authStore';

import { useMe } from './hooks/useAuth';

const queryClient = new QueryClient();

import { useOrgStore } from './store/orgStore';
import { orgApi } from './api/org';
import { MainLayout } from './components/layout/MainLayout';
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { collaborationApi } from './api/collaboration';

const LandingPage = React.lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPendingPage = React.lazy(() => import('./pages/auth/VerifyEmailPendingPage').then((m) => ({ default: m.VerifyEmailPendingPage })));
const VerifyEmailPage = React.lazy(() => import('./pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const OrgInvitePage = React.lazy(() => import('./pages/auth/OrgInvitePage').then((m) => ({ default: m.OrgInvitePage })));
const Analysis = React.lazy(() => import('./pages/Analysis').then((m) => ({ default: m.Analysis })));
const GitConnectPage = React.lazy(() => import('./pages/GitConnectPage').then((m) => ({ default: m.GitConnectPage })));
const TemplatesView = React.lazy(() => import('./components/dashboard').then((m) => ({ default: m.TemplatesView })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NLPDashboard = React.lazy(() => import('./pages/NLPDashboard').then((m) => ({ default: m.NLPDashboard })));
const ExportPage = React.lazy(() => import('./pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const DocumentSetupPage = React.lazy(() => import('./pages/DocumentSetupPage').then((m) => ({ default: m.DocumentSetupPage })));
const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ProjectWorkspacePage = React.lazy(() => import('./pages/ProjectWorkspacePage').then((m) => ({ default: m.ProjectWorkspacePage })));
const DocumentLibraryPage = React.lazy(() => import('./pages/DocumentLibraryPage').then((m) => ({ default: m.DocumentLibraryPage })));
const ProjectSourcePage = React.lazy(() => import('./pages/ProjectSourcePage').then((m) => ({ default: m.ProjectSourcePage })));
const ProjectActivityPage = React.lazy(() => import('./pages/ProjectActivityPage').then((m) => ({ default: m.ProjectActivityPage })));
const DocumentEditorPage = React.lazy(() => import('./pages/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage })));
const ProjectSettingsPage = React.lazy(() => import('./pages/ProjectSettingsPage').then((m) => ({ default: m.ProjectSettingsPage })));
const MembersPage = React.lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const OrgReportsPage = React.lazy(() => import('./pages/OrgReportsPage').then((m) => ({ default: m.OrgReportsPage })));
const AdminLoginPage = React.lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminRequestSignupPage = React.lazy(() => import('./pages/admin/AdminRequestSignupPage').then((m) => ({ default: m.AdminRequestSignupPage })));
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = React.lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminOrganizationsPage = React.lazy(() => import('./pages/admin/AdminOrganizationsPage').then((m) => ({ default: m.AdminOrganizationsPage })));
const AdminActivityPage = React.lazy(() => import('./pages/admin/AdminActivityPage').then((m) => ({ default: m.AdminActivityPage })));
const AdminSettingsPage = React.lazy(() => import('./pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminPendingPage = React.lazy(() => import('./pages/admin/AdminPendingPage').then((m) => ({ default: m.AdminPendingPage })));

const PageFallback = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

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
    <React.Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Admin routes (separate auth via OTP + Bearer token) — MUST be before catch-all */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/request-signup" element={<AdminRequestSignupPage />} />
        <Route element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
            <Route path="/admin/activity" element={<AdminActivityPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/pending-admins" element={<AdminPendingPage />} />
          </Route>
        </Route>

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
            <Route path="/members" element={<MembersPage />} />
            <Route path="/reports" element={<OrgReportsPage />} />
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
    </React.Suspense>
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
      <LiveblocksProvider authEndpoint={collaborationApi.authorize}>
        <BrowserRouter>
          <Toaster position="top-right" />
          <AppRoutes />
        </BrowserRouter>
      </LiveblocksProvider>
    </QueryClientProvider>
  );
}

export default App;
