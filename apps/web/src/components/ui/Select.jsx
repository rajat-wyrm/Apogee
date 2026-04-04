import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Select = forwardRef(function Select({ className, children, size = 'md', ...props }, ref) {
  const sizes = {
    sm: 'h-9 text-sm rounded-lg px-3',
    md: 'h-10 text-sm rounded-lg px-3.5',
    lg: 'h-12 text-base rounded-xl px-4',
  };
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full appearance-none bg-[var(--bg-elevated)] text-[var(--fg)]',
        'border border-[var(--border)] transition-all duration-200',
        'focus:outline-none focus:ring-4 focus:border-brand-500 focus:ring-brand-500/15',
        'hover:border-[var(--border-strong)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
