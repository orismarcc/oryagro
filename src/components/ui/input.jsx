import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full rounded border border-borda bg-white px-3 py-1 text-sm shadow-none transition-colors',
      'placeholder:text-gray-400',
      'focus:outline-none focus:ring-2 focus:ring-verde-800 focus:border-verde-800',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
export { Input };
