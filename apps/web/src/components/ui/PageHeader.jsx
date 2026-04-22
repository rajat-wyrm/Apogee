import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function PageHeader({ title, description, eyebrow, action, breadcrumbs, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-subtle)]">
            {breadcrumbs.map((b, idx) => (
              <span key={idx} className="inline-flex items-center gap-1">
                {b.to ? (
                  <Link to={b.to} className="hover:text-[var(--fg)] transition-colors">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="text-[var(--fg-subtle)]/60">/</span>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl text-balance"
        >
          {title}
        </motion.h1>
        {description && (
          <p className="max-w-2xl text-sm text-[var(--fg-subtle)] text-pretty">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export default PageHeader;
