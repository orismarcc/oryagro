import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref} sideOffset={sideOffset}
      className={cn('z-50 overflow-hidden rounded bg-[#2d2d2d] px-3 py-2 text-xs text-white shadow-md max-w-[260px] leading-relaxed animate-in fade-in-0 zoom-in-95', className)}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-[#2d2d2d]" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
