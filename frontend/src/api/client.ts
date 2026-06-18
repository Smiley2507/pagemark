import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { authApi } from './auth';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}

function clearAuth() {
  useAuthStore.getState().clearUser();
  const currentPath = window.location.pathname;
  const isOnPublicPath = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));
  if (!isOnPublicPath) {
    window.location.href = '/login';
  }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
    const activeOrgId = useOrgStore.getState().activeOrgId;
    if (activeOrgId) {
      config.headers['X-Organization-ID'] = activeOrgId.toString();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request is itself a refresh
    if (error.config?.url?.includes('/auth/refresh')) {
      clearAuth();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push(() => resolve(apiClient(error.config)));
      });
    }

    isRefreshing = true;

    try {
      await authApi.refreshSession();
      onRefreshed();
      isRefreshing = false;
      return apiClient(error.config);
    } catch {
      isRefreshing = false;
      refreshSubscribers = [];
      clearAuth();
      return Promise.reject(error);
    }
  }
);

export default apiClient;
