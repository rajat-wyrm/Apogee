import { cn } from '../../lib/utils';

const sizes = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
  xl: 'h-14 w-14 border-4',
};

const tones = {
  brand: 'border-brand-200 border-t-brand-600',
  accent: 'border-accent-200 border-t-accent-600',
  success: 'border-success-200 border-t-success-600',
  danger: 'border-danger-200 border-t-danger-600',
  white: 'border-white/30 border-t-white',
  current: 'border-current/30 border-t-current',
};

export function Spinner({ size = 'md', tone = 'brand', className, label }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} role="status">
      <span
        className={cn(
          'inline-block animate-spin rounded-full',
          sizes[size],
          tones[tone]
        )}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-[var(--fg-muted)]">{label}</span>}
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size="xl" />
      {label && <p className="text-sm text-[var(--fg-subtle)] animate-pulse">{label}</p>}
    </div>
  );
}

export default Spinner;
