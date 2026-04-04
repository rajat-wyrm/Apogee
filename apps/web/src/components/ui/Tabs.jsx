import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export function Tabs({ defaultValue, value, onValueChange, children, className }) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ children, className, variant = 'underline' }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative inline-flex items-center gap-1',
        variant === 'underline' &&
          'border-b border-[var(--border)] w-full overflow-x-auto no-scrollbar',
        variant === 'pills' && 'rounded-xl bg-[var(--bg-muted)] p-1',
        variant === 'boxed' && 'rounded-xl border border-[var(--border)] p-1',
        className
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ children, value, className, variant = 'underline', leftIcon }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'underline' &&
          'relative pb-3 pt-2 px-3 text-[var(--fg-subtle)] hover:text-[var(--fg)] data-[state=active]:text-[var(--fg)] data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand-600 data-[state=active]:after:rounded-full',
        variant === 'pills' &&
          'rounded-lg px-3.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--fg)] data-[state=active]:shadow-soft',
        variant === 'boxed' &&
          'rounded-lg px-3.5 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] data-[state=active]:bg-[var(--bg-muted)] data-[state=active]:text-[var(--fg)]',
        className
      )}
    >
      {leftIcon}
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ children, value, className }) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn('mt-4 focus-visible:outline-none data-[state=active]:animate-fade-in', className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

export default Tabs;
