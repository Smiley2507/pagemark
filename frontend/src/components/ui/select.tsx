import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldVariants, type InputProps } from '@/components/ui/input';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    Pick<InputProps, 'fieldSize' | 'state'> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, fieldSize, state, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          fieldVariants({ fieldSize, state }),
          'appearance-none pr-9',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  )
);
Select.displayName = 'Select';

export { Select };
