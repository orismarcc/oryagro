import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-verde-100 text-verde-800 border border-verde-400/30',
        warning:     'bg-yellow-50 text-yellow-800 border border-yellow-300',
        error:       'bg-red-50 text-red-700 border border-red-300',
        info:        'bg-blue-50 text-blue-700 border border-blue-300',
        secondary:   'bg-papel border border-borda text-gray-600',
        amber:       'bg-ambar-100 text-ambar-600 border border-ambar-600/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Badge = React.forwardRef(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';
export { Badge, badgeVariants };
