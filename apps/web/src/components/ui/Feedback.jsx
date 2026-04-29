import { cn } from '../../lib/utils';

export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' };
  return <span className={cn('inline-block rounded-full border-brand-200 border-t-brand-600 animate-spin', sizes[size], className)} />;
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Spinner size="lg" />
      <p className="text-sm text-fg-3">{label}</p>
    </div>
  );
}

export function Skeleton({ className, count = 1 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className={cn('skeleton-box h-4 w-full', className)} />
  ));
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {Icon && (
        <div className="h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center mb-3">
          <Icon size={22} />
        </div>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 text-sm text-fg-2 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value = 0, max = 100, color = 'bg-brand-600' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
      <div className={cn('h-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
