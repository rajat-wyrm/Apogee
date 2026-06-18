import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, FileText, FolderKanban, CheckSquare, Users, Calendar } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'documents', label: 'Documents' },
  { key: 'people', label: 'People' },
];

const TYPE_ICONS = {
  project: FolderKanban,
  task: CheckSquare,
  document: FileText,
  person: Users,
  event: Calendar,
};

export default function Search() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState('all');

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get('/search', { params: { q } }).then((r) => r.data).catch(() => []),
    enabled: q.length >= 2,
  });

  const filtered = useMemo(() => {
    if (active === 'all') return results;
    return results.filter((r) => r.type === active);
  }, [results, active]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="Search" description="Find anything across your workspace." />

      <Card padding="md">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects, tasks, people, documents…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          size="lg"
          autoFocus
        />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active === t.key ? 'bg-brand-600 text-white shadow-soft' : 'bg-[var(--bg-muted)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]/70'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {q.length < 2 ? (
        <EmptyState icon={SearchIcon} title="Start typing to search" description="Find projects, tasks, documents, and people across your workspace." />
      ) : isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchIcon} title={`No results for "${q}"`} description="Try different keywords or check your spelling." />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((r, idx) => {
              const Icon = TYPE_ICONS[r.type] || FileText;
              return (
                <li key={idx} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-muted)]/40 transition-colors">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title || r.name}</p>
                    <p className="text-xs text-[var(--fg-subtle)] truncate">{r.description || r.subtitle}</p>
                  </div>
                  <Badge tone="neutral">{r.type}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </motion.div>
  );
}
