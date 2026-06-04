import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

export const useMe = () => {
  return useQuery({
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
        navigate('/dashboard');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Login failed');
    },
  });
};

export const useRegister = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      if (user.is_first_login) {
        useAuthStore.getState().setShowWelcome(true);
      }
      if (!user.is_verified) {
        navigate('/verify-email-pending');
      } else {
        navigate('/dashboard');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Registration failed');
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      useAuthStore.getState().clearUser();
      toast.success('Logged out successfully');
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Logout failed');
    },
  });
};
