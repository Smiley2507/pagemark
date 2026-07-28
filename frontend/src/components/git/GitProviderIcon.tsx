import React from 'react';
import { Icon } from '@/components/icons/Icon';
import type { GitProvider } from '@/lib/git';

interface GitProviderIconProps {
  provider: GitProvider | null | undefined;
  className?: string;
}

export const GitProviderIcon: React.FC<GitProviderIconProps> = ({
  provider,
  className,
}) => {
  if (!provider) return null;
  return <Icon name={provider} className={className} size={20} aria-hidden />;
};
