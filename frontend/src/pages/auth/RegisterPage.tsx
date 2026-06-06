import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useRegister } from '@/hooks/useAuth';

export const RegisterPage = () => {
  const { mutate: register, isPending } = useRegister();

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Create a Project, connect your source, and write the first Document — no provider credential required to start."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          register(Object.fromEntries(formData) as {
            name: string;
            email: string;
            password: string;
            organization_name?: string;
          });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="John Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="organization_name">Organization name <span className="text-text-muted">(optional)</span></Label>
          <Input id="organization_name" name="organization_name" placeholder="Acme Corp" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" name="email" placeholder="name@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" name="password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" name="confirmPassword" required />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isPending}>
          {isPending ? 'Creating account\u2026' : 'Sign up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-meta text-text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-interaction hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
