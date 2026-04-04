import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref}
    className={cn('flex h-9 w-full items-center justify-between rounded border border-borda bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-verde-800 disabled:opacity-50', className)}
    {...props}>
    {children}
    <SelectPrimitive.Icon><ChevronDown size={14} className="text-gray-400" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content ref={ref}
      className={cn('relative z-50 min-w-[8rem] overflow-hidden rounded border border-borda bg-white shadow-md animate-in fade-in-80', className)}
      {...props}>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref}
    className={cn('relative flex cursor-default select-none items-center rounded py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-papel data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator><Check size={12} /></SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
