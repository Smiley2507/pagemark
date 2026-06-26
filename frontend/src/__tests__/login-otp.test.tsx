import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/pages/auth/LoginPage';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    verifyMfa: vi.fn(),
  },
}));

const loginMock = vi.mocked(authApi.login);
const verifyMfaMock = vi.mocked(authApi.verifyMfa);

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage OTP flow', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useAuthStore.getState().clearPendingMfa();
    useAuthStore.getState().clearUser();
    loginMock.mockReset();
    verifyMfaMock.mockReset();
  });

  it('keeps the OTP challenge after the login page remounts', async () => {
    loginMock.mockResolvedValue({
      requires_otp: true,
      message: 'Verification code sent to your email',
    });
    verifyMfaMock.mockResolvedValue({
      id: 7,
      email: 'celse@example.com',
      name: 'Celse',
      is_verified: true,
      is_first_login: false,
      created_at: '2026-06-26T00:00:00Z',
    });

    const firstRender = renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'celse@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await expect(screen.findByRole('heading', { name: 'Check your email' })).resolves.toBeVisible();
    expect(screen.getByText('Sent to celse@example.com')).toBeVisible();
    expect(window.sessionStorage.getItem('pagemark.pendingMfa')).toContain('celse@example.com');

    firstRender.unmount();
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText('Sent to celse@example.com')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Sign In' }));

    await waitFor(() => {
      expect(verifyMfaMock).toHaveBeenCalledWith('celse@example.com', '123456');
    });
  });
});
