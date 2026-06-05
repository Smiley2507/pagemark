import { Mail } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export const VerifyEmailPendingPage = () => {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout } = useLogout();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.is_verified) {
    return <Navigate to="/home" replace />;
  }

  return (
    <AuthLayout subtitle="Verify your email">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-medium tracking-tight">Check your inbox</h3>
          <p className="text-muted-foreground text-sm">
            We've sent a verification link to <span className="font-medium text-foreground">{user.email}</span>. 
            Please click the link to activate your account.
          </p>
        </div>
        <div className="pt-4 w-full flex flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            Back to login
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};
