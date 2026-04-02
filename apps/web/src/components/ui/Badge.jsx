import { cn } from '../../lib/utils';

const tones = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  accent: 'bg-accent-50 text-accent-700 ring-accent-600/20 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-400/20',
  success: 'bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/10 dark:text-success-300 dark:ring-success-400/20',
  warning: 'bg-warning-50 text-warning-700 ring-warning-600/20 dark:bg-warning-500/10 dark:text-warning-300 dark:ring-warning-400/20',
  danger: 'bg-danger-50 text-danger-700 ring-danger-600/20 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-400/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
  outline: 'bg-transparent text-[var(--fg)] ring-[var(--border-strong)]',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1',
  lg: 'px-3 py-1 text-sm gap-1.5',
};

export function Badge({ children, tone = 'neutral', size = 'md', leftIcon, rightIcon, className, dot = false }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'success' && 'bg-success-500',
            tone === 'warning' && 'bg-warning-500',
            tone === 'danger' && 'bg-danger-500',
            tone === 'brand' && 'bg-brand-500',
            tone === 'accent' && 'bg-accent-500',
            tone === 'neutral' && 'bg-slate-400'
          )}
          aria-hidden="true"
        />
      )}
      {leftIcon}
      {children}
      {rightIcon}
    </span>
  );
}

export default Badge;
