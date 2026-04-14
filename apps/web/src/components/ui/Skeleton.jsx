import { cn } from '../../lib/utils';

export function Skeleton({ className, variant = 'rect' }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton',
        variant === 'rect' && 'rounded-lg',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'rounded h-3 w-full',
        className
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-1/2 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export default Skeleton;
