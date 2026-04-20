import { cn } from '../../lib/utils';

const tones = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'brand',
  className,
  illustration = true,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14',
        'rounded-2xl border border-dashed border-[var(--border-strong)]',
        'bg-[var(--bg-muted)]/40',
        className
      )}
    >
      {illustration && Icon && (
        <div
          className={cn(
            'mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-inset',
            tones[tone],
            'shadow-soft'
          )}
        >
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
      {title && (
        <h3 className="text-base font-semibold text-[var(--fg)] tracking-tight">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-[var(--fg-subtle)] text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, retryLabel = 'Try again', icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14 rounded-2xl border border-dashed border-danger-300 bg-danger-50/30 dark:bg-danger-500/5 dark:border-danger-500/30">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-100 text-danger-600 dark:bg-danger-500/20">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--fg)]">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-[var(--fg-subtle)]">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
