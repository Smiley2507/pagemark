import type { ComponentType } from 'react';
import * as Lucide from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { RemixiconComponentType } from '@remixicon/react';
import { RiGithubFill, RiGitlabFill } from '@remixicon/react';
import { cn } from '@/lib/utils';

type RemixIcon = RemixiconComponentType;

function BitbucketIcon({
  className,
  size = 24,
  ...rest
}: {
  className?: string;
  size?: number | string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}) {
  const px = typeof size === 'number' ? size : 24;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      className={cn('shrink-0', className)}
      fill="currentColor"
      aria-hidden={rest['aria-hidden'] ?? !rest['aria-label']}
      aria-label={rest['aria-label']}
    >
      <path d="M.95 3.5A1.5 1.5 0 0 1 2.45 2h6.1c.6 0 1.12.36 1.35.92l1.1 2.58H20.5c.83 0 1.5.67 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H4.45A1.5 1.5 0 0 1 2.95 17V3.5zm3.5 4.25v8.5h14.05v-8.5H4.45z" />
    </svg>
  );
}

export type IconName = 'github' | 'gitlab' | 'bitbucket' | (string & {});

type IconEntry = {
  lucide?: LucideIcon;
  remix?: RemixIcon;
  custom?: ComponentType<{
    className?: string;
    size?: number | string;
    'aria-label'?: string;
    'aria-hidden'?: boolean;
  }>;
};

/** Icons missing from Lucide — Remix or custom SVG fallback. */
const ICON_REGISTRY: Record<string, IconEntry> = {
  github: { remix: RiGithubFill },
  gitlab: { remix: RiGitlabFill },
  bitbucket: { custom: BitbucketIcon },
};

function toLucideComponentName(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolveLucide(name: string): LucideIcon | undefined {
  const pascal = toLucideComponentName(name);
  const icons = Lucide as unknown as Record<string, LucideIcon | undefined>;
  return icons[pascal];
}

export type IconProps = {
  name: IconName;
  className?: string;
  size?: number | string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
};

/**
 * Lucide first when available in the registry or by name; otherwise Remix/custom.
 */
export function Icon({ name, className, size, ...rest }: IconProps) {
  const entry = ICON_REGISTRY[name];

  if (entry?.lucide) {
    const LucideIconComponent = entry.lucide;
    return (
      <LucideIconComponent
        className={cn('shrink-0', className)}
        size={typeof size === 'number' ? size : undefined}
        {...(rest as LucideProps)}
      />
    );
  }

  if (entry?.remix) {
    const RemixIconComponent = entry.remix;
    const px = typeof size === 'number' ? size : 24;
    return (
      <RemixIconComponent
        className={cn('shrink-0', className)}
        size={px}
        aria-hidden={rest['aria-hidden'] ?? !rest['aria-label']}
        aria-label={rest['aria-label']}
      />
    );
  }

  if (entry?.custom) {
    const Custom = entry.custom;
    return <Custom className={className} size={size} {...rest} />;
  }

  const LucideFallback = resolveLucide(name);
  if (LucideFallback) {
    return (
      <LucideFallback
        className={cn('shrink-0', className)}
        size={typeof size === 'number' ? size : undefined}
        {...(rest as LucideProps)}
      />
    );
  }

  return null;
}

export type AppIconProps = {
  className?: string;
  size?: number | string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
  lucide?: LucideIcon;
  remix?: RemixIcon;
};

export function AppIcon({ lucide, remix, className, size, ...rest }: AppIconProps) {
  if (lucide) {
    return (
      <lucide
        className={cn('shrink-0', className)}
        size={typeof size === 'number' ? size : undefined}
        {...(rest as LucideProps)}
      />
    );
  }
  if (remix) {
    const px = typeof size === 'number' ? size : 24;
    return (
      <remix
        className={cn('shrink-0', className)}
        size={px}
        aria-hidden={rest['aria-hidden'] ?? !rest['aria-label']}
        aria-label={rest['aria-label']}
      />
    );
  }
  return null;
}
