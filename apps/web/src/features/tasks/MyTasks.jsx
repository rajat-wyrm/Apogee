import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Loader, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { ListChecks, Search, Filter, Calendar as CalIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDate, formatRelative, isOverdue } from '../../lib/utils';
import { cn } from '../../lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'In review' },
  { value: 'done', label: 'Done' },
];

export default function MyTasks() {
  const { user, currentWorkspace } = useAuthStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');

  const tasks = useQuery({
    queryKey: ['my-tasks-full', user?.id, currentWorkspace?.id, status, priority],
    queryFn: () => {
      const params = new URLSearchParams({ workspace_id: currentWorkspace.id, assignee_id: user.id });
      if (status !== 'all') params.set('status', status);
      return api.get(`/tasks?${params}`).then((r) => r.data.data);
    },
    enabled: !!user && !!currentWorkspace,
  });

  const filtered = tasks.data?.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">My tasks</h1>
          <p className="text-sm text-fg-2 mt-0.5">{tasks.data?.length || 0} active</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="input pl-9 w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input w-auto">
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {tasks.isLoading ? <Loader /> : filtered?.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Inbox zero" description="You have no tasks. Time to take a break 🌴" />
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered?.map((t) => (
              <Link key={t.id} to={`/app/projects/${t.project_id}?task=${t.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2 transition">
                <div className={cn('h-2 w-2 rounded-full shrink-0', t.priority === 'urgent' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-400')} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-fg-3 flex items-center gap-2 mt-0.5">
                    <span className="truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.project_color || '#6366f1' }} />
                      {t.project_name}
                    </span>
                    <span>·</span>
                    <span>#{t.number}</span>
                  </div>
                </div>
                {t.status_name && <span className="badge" style={{ background: (t.status_color || '#94a3b8') + '22', color: t.status_color }}>{t.status_name}</span>}
                {t.due_date && (
                  <span className={cn('text-xs flex items-center gap-1', isOverdue(t.due_date) ? 'text-red-600' : 'text-fg-3')}>
                    <CalIcon size={11} /> {formatDate(t.due_date, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
