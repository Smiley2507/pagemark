import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { authApi } from '@/api/auth';
import { toast } from 'sonner';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setIsSubmitted(true);
      toast.success('Check your inbox for reset instructions');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Check className="h-6 w-6 text-foreground" />
          </div>
          <h2 className="text-section font-semibold">Check your email</h2>
          <p className="mt-2 text-meta text-muted-foreground">
            We sent a reset link to <span className="font-medium text-foreground">{email}</span>
          </p>
          <Link to="/login" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Back to login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Reset your password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isLoading}>
          {isLoading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-6 text-center">
        <Link to="/login" className="text-meta text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
};
