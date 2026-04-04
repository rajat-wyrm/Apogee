import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

const sizes = {
  sm: 'min-h-[80px] text-sm rounded-lg px-3 py-2',
  md: 'min-h-[110px] text-sm rounded-lg px-3.5 py-2.5',
  lg: 'min-h-[160px] text-base rounded-xl px-4 py-3',
};

export const Textarea = forwardRef(function Textarea(
  { label, description, error, size = 'md', className, containerClassName, id: idProp, required, rows = 4, ...props },
  ref
) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const describedById = description || error ? `${id}-desc` : undefined;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--fg)]">
          {label}
          {required && <span className="text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedById}
        required={required}
        className={cn(
          'block w-full resize-y bg-[var(--bg-elevated)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
          'border transition-all duration-200',
          'focus:outline-none focus:ring-4',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizes[size],
          error
            ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
            : 'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-brand-500 focus:ring-brand-500/15',
          className
        )}
        {...props}
      />
      {(description || error) && (
        <div id={describedById} className="mt-1.5 text-xs">
          {error ? (
            <span className="text-danger-600 dark:text-danger-500">{error}</span>
          ) : (
            <span className="text-[var(--fg-subtle)]">{description}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default Textarea;
