import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

const AUTH_CHANNEL = 'pagemark-auth';

function setupBroadcastChannel() {
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') {
        useAuthStore.getState().clearUser();
      }
    };
    return channel;
  } catch {
    return null;
  }
}

function startPeriodicRefresh(intervalMs = 25 * 60 * 1000) {
  const id = setInterval(async () => {
    try {
      await authApi.refreshSession();
    } catch {
      // swallow errors — the interceptor in client.ts handles 401s
    }
  }, intervalMs);
  return () => clearInterval(id);
}

export const useSessionSync = () => {
  const user = useAuthStore((s) => s.user);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;

    channelRef.current = setupBroadcastChannel();
    cleanupRef.current = startPeriodicRefresh();

    return () => {
      channelRef.current?.close();
      cleanupRef.current?.();
    };
  }, [user]);
};

export const useMe = () => {
  const query = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const user = await authApi.getMe();
        useAuthStore.getState().setUser(user);
        return user;
      } catch (error) {
        useAuthStore.getState().clearUser();
        throw error;
      }
    },
    retry: false,
  });

  useSessionSync();

  return query;
};

export const useLogin = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      if (user.is_first_login) {
        useAuthStore.getState().setShowWelcome(true);
      }
      if (!user.is_verified) {
        navigate('/verify-email-pending');
      } else {
        navigate('/home');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Login failed');
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      if (!user.is_verified) {
        useAuthStore.getState().clearUser();
        navigate('/verify-email-pending', { state: { email: user.email } });
      } else {
        useAuthStore.getState().setUser(user);
        if (user.is_first_login) {
          useAuthStore.getState().setShowWelcome(true);
        }
        navigate('/home');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Registration failed');
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      try {
        new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: 'logout' });
      } catch { /* cross-tab sync best-effort */ }
      useAuthStore.getState().clearUser();
      toast.success('Logged out successfully');
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Logout failed');
    },
  });
};
