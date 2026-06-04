import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateMutation = useMutation({
    mutationFn: (payload: { name?: string; avatar_url?: string; password?: string }) =>
      authApi.updateMe(payload),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast.success('Profile updated');
      if (password) {
        setPassword('');
        setConfirmPassword('');
      }
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail || 'Failed to update profile'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const payload: { name?: string; avatar_url?: string; password?: string } = {};
    if (name !== user?.name) payload.name = name;
    if (avatarUrl !== (user?.avatar_url || '')) payload.avatar_url = avatarUrl;
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0) {
      toast.error('No changes to save');
      return;
    }
    updateMutation.mutate(payload);
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-section font-semibold">Profile</h2>
        <p className="text-meta text-muted-foreground">
          Manage your personal account settings
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              (user?.name || 'U')[0].toUpperCase()
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{user?.name || 'User'}</p>
            <p className="text-meta text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Separator />

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Avatar URL */}
        <div className="space-y-2">
          <Label htmlFor="avatar-url">Avatar URL</Label>
          <Input
            id="avatar-url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <Separator />

        {/* Password */}
        <div>
          <h3 className="text-sm font-medium mb-1">Change password</h3>
          <p className="text-meta text-muted-foreground mb-4">
            Leave blank to keep your current password
          </p>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2 mt-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
