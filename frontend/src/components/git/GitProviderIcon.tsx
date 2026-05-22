import React from 'react';
import { cn } from '@/lib/utils';
import type { GitProvider } from '@/lib/git';

interface GitProviderIconProps {
  provider: GitProvider | null | undefined;
  className?: string;
}

export const GitProviderIcon: React.FC<GitProviderIconProps> = ({
  provider,
  className,
}) => {
  if (provider === 'github') {
    return (
      <svg className={cn('h-5 w-5', className)} viewBox="0 0 19 19" aria-hidden>
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (provider === 'gitlab') {
    return (
      <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M22.65 9.5l-2.14-6.58a1.2 1.2 0 0 0-2.28 0L16.5 9.5H7.5L5.77 2.92a1.2 1.2 0 0 0-2.28 0L1.35 9.5a1.2 1.2 0 0 0 .44 1.36l9.35 6.8-3.7-11.38h4.12l2.28 7.01 2.28-7.01h4.12l-3.7 11.38 9.35-6.8a1.2 1.2 0 0 0 .44-1.36z"
        />
      </svg>
    );
  }

  if (provider === 'bitbucket') {
    return (
      <svg className={cn('h-5 w-5', className)} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M.95 3.5A1.5 1.5 0 0 1 2.45 2h6.1c.6 0 1.12.36 1.35.92l1.1 2.58H20.5c.83 0 1.5.67 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H4.45A1.5 1.5 0 0 1 2.95 17V3.5zm3.5 4.25v8.5h14.05v-8.5H4.45z"
        />
      </svg>
    );
  }

  return null;
};
