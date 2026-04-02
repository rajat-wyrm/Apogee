import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '../../lib/utils';

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-20 w-20 text-xl',
};

const tones = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
  neutral: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pickTone(name = '') {
  const tones = ['brand', 'accent', 'success', 'warning', 'danger'];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return tones[sum % tones.length];
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  tone,
  className,
  status,
  ring = false,
}) {
  const initials = getInitials(name || alt);
  const toneClass = tone || (name ? pickTone(name) : 'neutral');
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold',
          sizes[size],
          tones[toneClass],
          ring && 'ring-2 ring-[var(--bg-elevated)]'
        )}
      >
        {src && <AvatarPrimitive.Image src={src} alt={alt || name} className="h-full w-full object-cover" />}
        <AvatarPrimitive.Fallback className="font-semibold" delayMs={src ? 200 : 0}>
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg-elevated)]',
            status === 'online' && 'bg-success-500',
            status === 'away' && 'bg-warning-500',
            status === 'busy' && 'bg-danger-500',
            status === 'offline' && 'bg-slate-400'
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export function AvatarGroup({ children, max = 4, size = 'sm' }) {
  const items = Array.isArray(children) ? children : [children];
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((child, idx) => (
        <div key={idx} className="ring-2 ring-[var(--bg-elevated)] rounded-full">
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-700 font-semibold ring-2 ring-[var(--bg-elevated)]',
            'dark:bg-slate-700 dark:text-slate-200',
            sizes[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export default Avatar;
