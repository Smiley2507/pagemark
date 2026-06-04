import React from 'react';
import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-rose-500',
  'from-indigo-500 to-violet-500',
  'from-amber-500 to-yellow-500',
  'from-sky-500 to-blue-500',
  'from-fuchsia-500 to-purple-500',
  'from-lime-500 to-emerald-500',
  'from-pink-500 to-rose-500',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface UserBadgeProps {
  name?: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserBadge({ name = 'U', avatarUrl, size = 'sm', className }: UserBadgeProps) {
  const initials = getInitials(name);
  const gradient = avatarUrl
    ? ''
    : GRADIENTS[hashName(name) % GRADIENTS.length];

  const sizeMap = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  if (avatarUrl) {
    return (
      <div
        className={cn('rounded-full overflow-hidden shrink-0', sizeMap[size], className)}
      >
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-white shrink-0 bg-gradient-to-br',
        gradient,
        sizeMap[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
