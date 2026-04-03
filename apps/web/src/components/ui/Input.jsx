import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const sizes = {
  sm: 'h-9 text-sm rounded-lg px-3',
  md: 'h-10 text-sm rounded-lg px-3.5',
  lg: 'h-12 text-base rounded-xl px-4',
};

export const Input = forwardRef(function Input(
  {
    label,
    description,
    error,
    success,
    leftIcon,
    rightIcon,
    size = 'md',
    className,
    containerClassName,
    id: idProp,
    type = 'text',
    required,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = idProp || generatedId;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const describedById = description || error ? `${id}-desc` : undefined;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--fg)]"
        >
          {label}
          {required && <span className="text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative group">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--fg-subtle)] group-focus-within:text-brand-600 dark:group-focus-within:text-brand-400 transition-colors">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={inputType}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedById}
          required={required}
          className={cn(
            'block w-full bg-[var(--bg-elevated)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
            'border transition-all duration-200',
            'focus:outline-none focus:ring-4',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizes[size],
            leftIcon && 'pl-10',
            (rightIcon || isPassword) && 'pr-10',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
              : success
              ? 'border-success-500 focus:border-success-500 focus:ring-success-500/15'
              : 'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-brand-500 focus:ring-brand-500/15',
            className
          )}
          {...props}
        />
        {(rightIcon || isPassword) && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--fg-subtle)]">
            {isPassword ? (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-md p-1 hover:bg-[var(--bg-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            ) : (
              rightIcon
            )}
          </span>
        )}
      </div>
      {(description || error || success) && (
        <div id={describedById} className="mt-1.5 flex items-start gap-1.5 text-xs">
          {error && (
            <>
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-500" aria-hidden="true" />
              <span className="text-danger-600 dark:text-danger-500">{error}</span>
            </>
          )}
          {success && !error && (
            <>
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-500" aria-hidden="true" />
              <span className="text-success-600 dark:text-success-500">{success}</span>
            </>
          )}
          {description && !error && !success && (
            <span className="text-[var(--fg-subtle)]">{description}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default Input;
