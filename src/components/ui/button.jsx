import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-800 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-verde-800 text-white hover:bg-verde-700',
        outline: 'border border-borda bg-white text-gray-700 hover:bg-papel hover:border-verde-800 hover:text-verde-800',
        ghost: 'hover:bg-papel text-gray-600 hover:text-gray-900',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        secondary: 'bg-papel border border-borda text-gray-700 hover:bg-papel-dark',
        amber: 'border border-ambar-600 text-ambar-600 bg-white hover:bg-ambar-50',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';
export { Button, buttonVariants };
