import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore, useNotificationStore, usePresenceStore } from '../../store';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Avatar, AvatarGroup } from '../../components/ui/Avatar';
import { Sparkles, ArrowRight, Plus, CheckCircle2, Clock, AlertCircle, TrendingUp, Zap, Target, FileText, ListTodo, Users, Calendar, BarChart3, Activity, ChevronRight, Calendar as CalendarIcon, Briefcase, Layers, CheckCheck, ArrowUpRight, BarChart2, Sparkle, Lightbulb } from 'lucide-react';
import { formatRelative, formatDate, isOverdue, cn, pluralize } from '../../lib/utils';
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { currentOrganization, currentWorkspace, user } = useAuthStore();
  const { setUnread } = useNotificationStore();
  const orgId = currentOrganization?.id;
  const wsId = currentWorkspace?.id;

  const overview = useQuery({
    queryKey: ['overview', orgId],
    queryFn: () => api.get(`/analytics/overview?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });

  const projects = useQuery({
    queryKey: ['projects', wsId],
    queryFn: () => api.get(`/projects?workspace_id=${wsId}`).then((r) => r.data.data || []),
    enabled: !!wsId,
  });

  const myTasks = useQuery({
    queryKey: ['my-tasks', user?.id, wsId],
    queryFn: () => api.get(`/tasks?workspace_id=${wsId}&assignee_id=${user.id}`).then((r) => r.data.data || []),
    enabled: !!wsId && !!user,
  });

  const productivity = useQuery({
    queryKey: ['productivity', orgId],
    queryFn: () => api.get(`/analytics/productivity?organization_id=${orgId}`).then((r) => r.data.data || []),
    enabled: !!orgId,
  });

  const activity = useQuery({
    queryKey: ['activity', orgId],
    queryFn: () => api.get(`/activity/feed?organization_id=${orgId}&workspace_id=${wsId}`).then((r) => r.data.data || []),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const stats = useMemo(() => [
    { label: 'Active projects', value: overview.data?.active_projects, icon: Briefcase, color: 'text-brand-600 bg-brand-100 dark:bg-brand-900/30' },
    { label: 'Open tasks', value: overview.data?.total_tasks, icon: ListTodo, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Done this week', value: overview.data?.completed_week, icon: CheckCircle2, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
    { label: 'Overdue', value: overview.data?.overdue, icon: AlertCircle, color: 'text-danger bg-danger/10' },
  ], [overview.data]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Welcome */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-fg-2 mt-1">Here's what's happening in <span className="font-medium text-fg">{currentWorkspace?.name || 'your workspace'}</span> today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/projects" className="btn-secondary btn-sm"><Plus size={14} /> Project</Link>
          <Link to="/app/tasks" className="btn-primary btn-sm"><Plus size={14} /> Task</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4 hover:shadow-md transition group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-fg-2">{s.label}</div>
                <div className="text-2xl sm:text-3xl font-bold mt-0.5">{s.value ?? '—'}</div>
              </div>
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition', s.color)}>
                <s.icon size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* My tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My tasks</CardTitle>
              <p className="text-xs text-fg-3 mt-0.5">{pluralize(myTasks.data?.length || 0, 'task')}</p>
            </div>
            <Link to="/app/tasks" className="text-xs link inline-flex items-center gap-1">View all <ArrowRight size={10} /></Link>
          </CardHeader>
          <CardContent className="p-0">
            {myTasks.isLoading ? <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton skeleton-text w-full" />)}</div> :
             !myTasks.data?.length ? (
              <div className="p-12 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 mx-auto flex items-center justify-center mb-2">
                  <CheckCheck size={20} />
                </div>
                <p className="text-sm font-medium">All clear!</p>
                <p className="text-xs text-fg-3 mt-0.5">You have no tasks assigned.</p>
              </div>
            ) : (
              <div className="divide-y divide-default max-h-[28rem] overflow-y-auto">
                {myTasks.data.slice(0, 12).map((t) => {
                  const prio = { urgent: 'bg-danger', high: 'bg-warning', medium: 'bg-amber-500', low: 'bg-info', none: 'bg-fg-3' }[t.priority] || 'bg-fg-3';
                  return (
                    <Link key={t.id} to={`/app/projects/${t.project_id}?task=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition group">
                      <div className={cn('h-2 w-2 rounded-full shrink-0', prio)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-brand-600 transition">{t.title}</div>
                        <div className="text-xs text-fg-3 flex items-center gap-2 mt-0.5">
                          <span className="truncate">{t.project_name}</span>
                          <span>·</span>
                          <span>#{t.number}</span>
                        </div>
                      </div>
                      {t.status_name && (
                        <span className="badge" style={{ background: (t.status_color || '#94a3b8') + '22', color: t.status_color }}>{t.status_name}</span>
                      )}
                      {t.due_date && (
                        <span className={cn('text-xs flex items-center gap-1', isOverdue(t.due_date) && !t.completed_at ? 'text-danger font-medium' : 'text-fg-3')}>
                          <CalendarIcon size={10} /> {formatDate(t.due_date, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <p className="text-xs text-fg-3 mt-0.5">Live updates from your team</p>
          </CardHeader>
          <CardContent className="p-0 max-h-[28rem] overflow-y-auto">
            {!activity.data?.length ? (
              <p className="p-8 text-center text-xs text-fg-3">No activity yet</p>
            ) : (
              <div className="divide-y divide-default">
                {activity.data.slice(0, 20).map((a) => (
                  <div key={a.id} className="flex gap-2.5 p-3">
                    <Avatar name={a.actor_name} src={a.actor_avatar} size="xs" />
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-medium">{a.actor_name || 'Someone'}</span>{' '}
                      <span className="text-fg-2">{a.verb || a.summary?.split(' ')[0]}</span>{' '}
                      <span className="font-medium truncate">{a.summary || ''}</span>
                      <div className="text-[10px] text-fg-3 mt-0.5">{formatRelative(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Projects</CardTitle>
            <p className="text-xs text-fg-3 mt-0.5">Your active projects</p>
          </div>
          <Link to="/app/projects" className="text-xs link inline-flex items-center gap-1">View all <ArrowRight size={10} /></Link>
        </CardHeader>
        <CardContent className="p-4">
          {!projects.data?.length ? (
            <div className="p-8 text-center">
              <Briefcase size={32} className="mx-auto text-fg-3 mb-2" />
              <p className="text-sm font-medium">No projects yet</p>
              <Link to="/app/projects" className="btn-primary btn-sm mt-3">Create your first project</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.data.slice(0, 6).map((p) => {
                const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
                return (
                  <Link key={p.id} to={`/app/projects/${p.id}`} className="card p-4 card-hover group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: p.color || '#6366f1' }}>
                        {p.icon || p.name[0]?.toUpperCase()}
                      </div>
                      <ChevronRight size={14} className="text-fg-3 group-hover:translate-x-0.5 transition" />
                    </div>
                    <h3 className="font-semibold text-sm truncate group-hover:text-brand-600 transition">{p.name}</h3>
                    {p.description && <p className="text-xs text-fg-3 mt-0.5 line-clamp-1">{p.description}</p>}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-fg-2">{p.task_count || 0} {pluralize(p.task_count || 0, 'task')}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      {overview.data && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white">
                <Sparkles size={14} />
              </div>
              <div>
                <CardTitle>AI insights</CardTitle>
                <p className="text-xs text-fg-3 mt-0.5">Powered by your data</p>
              </div>
            </div>
            <Link to="/app/ai" className="text-xs link">Open AI</Link>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link to="/app/tasks" className="p-3 rounded-lg border border-default hover:border-brand-300 hover:bg-surface-2 transition group">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb size={14} className="text-warning" />
                  <span className="text-sm font-medium">Focus suggestion</span>
                </div>
                <p className="text-xs text-fg-2">You have {overview.data.overdue || 0} overdue tasks. {overview.data.overdue > 0 ? 'Start with the most urgent one.' : 'Great work — you\'re on top of things!'}</p>
              </Link>
              <Link to="/app/projects" className="p-3 rounded-lg border border-default hover:border-brand-300 hover:bg-surface-2 transition group">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium">Productivity</span>
                </div>
                <p className="text-xs text-fg-2">Completed {overview.data.completed_week || 0} tasks this week. {overview.data.completed_week > 5 ? 'Great pace!' : 'Keep going.'}</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
