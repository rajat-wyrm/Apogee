import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default:
    'bg-[var(--bg-elevated)] border border-[var(--border)] shadow-soft',
  elevated:
    'bg-[var(--bg-elevated)] border border-[var(--border)] shadow-large',
  bordered:
    'bg-transparent border border-[var(--border)]',
  glass:
    'glass',
  flat:
    'bg-[var(--bg-muted)] border border-transparent',
  gradient:
    'text-white border border-white/10 shadow-glow bg-[image:var(--gradient-primary)]',
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef(function Card(
  { variant = 'default', padding = 'md', interactive = false, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-2xl transition-all duration-200',
        variants[variant],
        paddings[padding],
        interactive && 'hover:-translate-y-0.5 hover:shadow-large cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-base font-semibold text-[var(--fg)] tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-sm text-[var(--fg-subtle)] mt-0.5', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('text-[var(--fg-muted)]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn('mt-6 flex items-center justify-between gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
