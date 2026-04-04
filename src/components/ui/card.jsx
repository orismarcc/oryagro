import * as React from 'react';
import { cn } from '@/lib/utils';
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded bg-white border border-borda', className)} {...props} />
));
Card.displayName = 'Card';
export { Card };
