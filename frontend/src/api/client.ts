import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    config.headers['Content-Type'] = 'application/json';
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear the user from the Zustand store so React Router's
      // <ProtectedRoute> picks up the state change and redirects
      // cleanly without a full page reload.
      useAuthStore.getState().clearUser();

      // Only force a hard redirect when the user is NOT already on a
      // public auth page, to prevent an infinite reload loop where
      // unauthenticated /me checks on /login itself trigger a redirect.
      const currentPath = window.location.pathname;
      const isOnPublicPath = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));
      if (!isOnPublicPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
