import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useLogin } from '@/hooks/useAuth';

export const LoginPage = () => {
  const { mutate: login, isPending } = useLogin();

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off with your Documents, Sections, and review state."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          login(Object.fromEntries(formData) as { email: string; password: string });
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" name="email" placeholder="name@example.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-meta text-interaction hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" name="password" required />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-meta text-text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-interaction hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};
