import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input file:text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-white px-3 py-1 text-base text-gray-900 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-400',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
