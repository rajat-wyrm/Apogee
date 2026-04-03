import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dropdown({ trigger, children, align = 'end', sideOffset = 8, className }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-50 min-w-[12rem] overflow-hidden rounded-xl p-1.5',
            'glass-strong shadow-large',
            'data-[state=open]:animate-scale-in',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
            className
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DropdownItem({ children, className, leftIcon, rightIcon, inset, ...props }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm',
        'text-[var(--fg)] outline-none transition-colors',
        'data-[highlighted]:bg-[var(--bg-muted)] data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {leftIcon && <span className="text-[var(--fg-subtle)]">{leftIcon}</span>}
      <span className="flex-1">{children}</span>
      {rightIcon && <span className="text-[var(--fg-subtle)]">{rightIcon}</span>}
    </DropdownMenu.Item>
  );
}

export function DropdownCheckboxItem({ children, checked, ...props }) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-8 pr-3 text-sm',
        'text-[var(--fg)] outline-none transition-colors',
        'data-[highlighted]:bg-[var(--bg-muted)]'
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check className="h-4 w-4 text-brand-600" />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function DropdownLabel({ children, className }) {
  return (
    <DropdownMenu.Label
      className={cn('px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--fg-subtle)]', className)}
    >
      {children}
    </DropdownMenu.Label>
  );
}

export function DropdownSeparator({ className }) {
  return <DropdownMenu.Separator className={cn('my-1 h-px bg-[var(--border)]', className)} />;
}

export function DropdownSub({ trigger, children }) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm',
          'text-[var(--fg)] outline-none transition-colors',
          'data-[highlighted]:bg-[var(--bg-muted)]'
        )}
      >
        <span className="flex-1 text-left">{trigger}</span>
        <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          className={cn(
            'z-50 min-w-[10rem] overflow-hidden rounded-xl p-1.5',
            'glass-strong shadow-large',
            'data-[state=open]:animate-scale-in'
          )}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

export const DropdownPortal = DropdownMenu.Portal;

export default Dropdown;
