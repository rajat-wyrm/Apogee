import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variants = {
  primary:
    'bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-medium active:bg-brand-700 focus-visible:ring-brand-500',
  secondary:
    'bg-[var(--bg-muted)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] focus-visible:ring-[var(--ring)]',
  outline:
    'bg-transparent text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--bg-muted)] focus-visible:ring-[var(--ring)]',
  ghost:
    'bg-transparent text-[var(--fg)] hover:bg-[var(--bg-muted)] focus-visible:ring-[var(--ring)]',
  soft:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-950/60 focus-visible:ring-brand-500',
  danger:
    'bg-danger-600 text-white shadow-soft hover:bg-danger-700 focus-visible:ring-danger-500',
  success:
    'bg-success-600 text-white shadow-soft hover:bg-success-700 focus-visible:ring-success-500',
  gradient:
    'text-white shadow-glow bg-[image:var(--gradient-primary)] hover:opacity-95 active:opacity-90 border border-white/10',
};

const sizes = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-base gap-2 rounded-xl',
  xl: 'h-12 px-6 text-base gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
  'icon-lg': 'h-12 w-12 rounded-xl',
};

export const Button = forwardRef(function Button(
  {
    as: Comp = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <Comp
      ref={ref}
      type={Comp === 'button' ? type : undefined}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-all duration-200 ease-out',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {!loading && leftIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      <span className={cn('inline-flex items-center', loading && 'opacity-0')}>{children}</span>
      {!loading && rightIcon && (
        <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </Comp>
  );
});

export default Button;
