import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useRegister } from '@/hooks/useAuth';

export const RegisterPage = () => {
  const { mutate: register, isPending } = useRegister();
  const [password, setPassword] = useState('');

  const strength =
    password.length === 0
      ? { label: 'Too short', width: '0%' }
      : password.length < 6
        ? { label: 'Weak', width: '33%' }
        : password.length < 10
          ? { label: 'Medium', width: '66%' }
          : { label: 'Strong', width: '100%' };

  return (
    <AuthLayout subtitle="Create your account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          register(Object.fromEntries(formData) as {
            name: string;
            email: string;
            password: string;
          });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="John Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" name="email" placeholder="name@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: strength.width }}
            />
          </div>
          <p className="text-meta-sm text-muted-foreground">Strength: {strength.label}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" name="confirmPassword" required />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-meta text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
