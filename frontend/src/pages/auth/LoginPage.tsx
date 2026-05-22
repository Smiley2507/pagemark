import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/useAuth';

export const LoginPage = () => {
  const { mutate: login, isPending } = useLogin();
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (data: any) => {
    login(data);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 transition-all"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            <Layout className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome to Pagemark</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Please enter your details to sign in</p>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleSubmit(Object.fromEntries(formData));
        }} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">Password</Label>
              <Link to="/forgot-password" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700"
            />
            <Label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-350 cursor-pointer">
              Remember me
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 shadow-sm hover:shadow-indigo-500/10"
            disabled={isPending}
          >
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
