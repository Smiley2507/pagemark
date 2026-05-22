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
import { Quality } from './pages/Quality';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { GitConnectPage } from './pages/GitConnectPage';
import { useMe } from './hooks/useAuth';

const queryClient = new QueryClient();

/** Sends authenticated users to /dashboard, guests to /login. */
const RootRedirect = () => {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
};

const AppRoutes = () => {
  const { isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading session...</p>
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

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new-project" element={<NewProject />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/analysis/:id" element={<Analysis />} />
        <Route path="/quality/:id" element={<Quality />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/git-connect" element={<GitConnectPage />} />
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
