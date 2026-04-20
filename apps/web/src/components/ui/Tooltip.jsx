import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

export function TooltipProvider({ children, delayDuration = 200 }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({ children, content, side = 'top', align = 'center', className, open, defaultOpen }) {
  return (
    <TooltipPrimitive.Root open={open} defaultOpen={defaultOpen}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-lg px-2.5 py-1.5 text-xs font-medium',
            'bg-slate-900 text-white shadow-large',
            'dark:bg-white dark:text-slate-900',
            'data-[state=delayed-open]:animate-fade-in',
            'data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1',
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-white" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export default Tooltip;
