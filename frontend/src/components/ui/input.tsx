import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const fieldVariants = cva(
  'flex w-full rounded-md border border-input bg-panel text-body text-text-primary transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      fieldSize: {
        sm: 'h-8 px-2.5 py-1 text-meta',
        default: 'h-9 px-3 py-1',
        lg: 'h-10 px-3.5 py-2',
      },
      state: {
        default: '',
        invalid: 'border-status-danger-foreground text-status-danger-foreground',
        success: 'border-status-success-foreground',
      },
    },
    defaultVariants: {
      fieldSize: 'default',
      state: 'default',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof fieldVariants> {
  size?: React.InputHTMLAttributes<HTMLInputElement>['size'];
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, fieldSize, state, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'file:border-0 file:bg-transparent file:text-body file:font-medium',
        fieldVariants({ fieldSize, state }),
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input, fieldVariants };
