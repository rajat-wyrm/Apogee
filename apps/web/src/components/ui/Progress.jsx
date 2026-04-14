import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

const tones = {
  brand: 'bg-brand-600',
  accent: 'bg-accent-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
  gradient: 'bg-[image:var(--gradient-primary)]',
};

const sizes = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export function Progress({ value = 0, max = 100, tone = 'brand', size = 'md', showLabel = false, className, indeterminate = false }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--fg-muted)]">Progress</span>
          <span className="tabular-nums text-[var(--fg)]">{Math.round(pct)}%</span>
        </div>
      )}
      <ProgressPrimitive.Root
        value={indeterminate ? null : value}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--bg-muted)]',
          sizes[size]
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full transition-transform duration-700 ease-out',
            tones[tone],
            indeterminate && 'animate-pulse-glow w-1/3'
          )}
          style={{
            transform: indeterminate ? undefined : `translateX(-${100 - pct}%)`,
          }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}

export default Progress;
