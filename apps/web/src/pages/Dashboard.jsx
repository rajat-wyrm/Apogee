import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderKanban, CheckSquare, Users, TrendingUp, ArrowRight, Sparkles,
  PlusCircle, Activity, Calendar, Clock, CheckCircle2, CircleDashed,
  ChevronRight, Zap, Bot
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import useAuthStore from '../store/authStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const CHART_COLORS = ['#3b62ff', '#a855f7', '#10b981', '#f59e0b', '#ef4444'];

function StatCard({ icon: Icon, label, value, change, tone = 'brand' }) {
  const positive = typeof change === 'number' ? change >= 0 : null;
  return (
    <Card padding="md" interactive>
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-xl',
            tone === 'brand' && 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
            tone === 'accent' && 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300',
            tone === 'success' && 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300',
            tone === 'warning' && 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {positive !== null && (
          <Badge tone={positive ? 'success' : 'danger'} dot>
            {positive ? '+' : ''}{change}%
          </Badge>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-[var(--fg)]">{value}</p>
        <p className="mt-0.5 text-sm text-[var(--fg-subtle)]">{label}</p>
      </div>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-large">
      {label && <p className="text-xs font-medium text-[var(--fg-subtle)]">{label}</p>}
      {payload.map((p, idx) => (
        <p key={idx} className="text-sm text-[var(--fg)]">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { organizations, selectedOrgId, selectedWorkspaceId } = useOrgStore();
  const user = useAuthStore((s) => s.user);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', selectedWorkspaceId],
    queryFn: () => api.get('/projects', { params: { workspaceId: selectedWorkspaceId } }).then((r) => r.data),
    enabled: !!selectedWorkspaceId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', selectedWorkspaceId],
    queryFn: () => api.get(`/workspaces/${selectedWorkspaceId}/members`).then((r) => r.data),
    enabled: !!selectedWorkspaceId,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'there';

  const stats = [
    { icon: FolderKanban, label: 'Active projects', value: projects.filter((p) => p.status === 'active').length || projects.length || 0, change: 12, tone: 'brand' },
    { icon: CheckSquare, label: 'Open tasks', value: '—', change: -3, tone: 'accent' },
    { icon: Users, label: 'Team members', value: members.length, change: 5, tone: 'success' },
    { icon: TrendingUp, label: 'Completion rate', value: '78%', change: 8, tone: 'warning' },
  ];

  const trendData = [
    { day: 'Mon', completed: 12, created: 18 },
    { day: 'Tue', completed: 18, created: 14 },
    { day: 'Wed', completed: 9, created: 22 },
    { day: 'Thu', completed: 24, created: 16 },
    { day: 'Fri', completed: 20, created: 19 },
    { day: 'Sat', completed: 7, created: 5 },
    { day: 'Sun', completed: 4, created: 3 },
  ];

  const priorityData = [
    { name: 'High', value: 8 },
    { name: 'Medium', value: 14 },
    { name: 'Low', value: 6 },
  ];

  if (!selectedOrgId) {
    return (
      <EmptyState
        icon={Sparkles}
        tone="brand"
        title="Welcome to Apogee"
        description="Create or select an organization from the sidebar to get started."
        action={<Button leftIcon={<PlusCircle className="h-4 w-4" />}>Create organization</Button>}
      />
    );
  }

  if (!selectedWorkspaceId) {
    return (
      <EmptyState
        icon={PlusCircle}
        tone="brand"
        title="Create a workspace"
        description="Use the sidebar to create your first workspace, then manage projects and tasks."
      />
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={item}>
        <PageHeader
          eyebrow={`${greeting} ??`}
          title={`${greeting}, ${firstName}`}
          description="Here's a quick overview of what's happening across your workspace today."
          action={
            <>
              <Button as={Link} to="/app/ai" variant="outline" leftIcon={<Bot className="h-4 w-4" />}>
                Ask AI
              </Button>
              <Button as={Link} to="/app/projects" variant="gradient" leftIcon={<PlusCircle className="h-4 w-4" />}>
                New project
              </Button>
            </>
          }
        />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} />
        ))}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card padding="md">
            <CardHeader className="mb-2">
              <div>
                <CardTitle>Productivity</CardTitle>
                <CardDescription>Tasks completed vs created this week</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]"><span className="h-2 w-2 rounded-full bg-brand-500" /> Completed</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]"><span className="h-2 w-2 rounded-full bg-accent-500" /> Created</span>
              </div>
            </CardHeader>
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b62ff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b62ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="completed" stroke="#3b62ff" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="created" stroke="#a855f7" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card padding="md" className="h-full">
            <CardHeader className="mb-2">
              <div>
                <CardTitle>Priority mix</CardTitle>
                <CardDescription>This week's task distribution</CardDescription>
              </div>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {priorityData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: 'var(--fg-muted)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card padding="md">
            <CardHeader className="mb-4">
              <div>
                <CardTitle>Recent projects</CardTitle>
                <CardDescription>Pick up where you left off</CardDescription>
              </div>
              <Button as={Link} to="/app/projects" variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                View all
              </Button>
            </CardHeader>
            {projectsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create your first project to start organizing work."
                action={<Button as={Link} to="/app/projects" leftIcon={<PlusCircle className="h-4 w-4" />}>Create project</Button>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.slice(0, 4).map((p) => (
                  <Link
                    key={p.id}
                    to={`/app/projects/${p.id}`}
                    className="group rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-4 transition-all hover:border-brand-300 hover:bg-brand-50/30 hover:shadow-soft dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                          <FolderKanban className="h-4 w-4" />
                        </span>
                        <span className="font-semibold text-[var(--fg)]">{p.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--fg)]" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <Badge tone={p.status === 'completed' ? 'success' : p.status === 'archived' ? 'neutral' : 'brand'} dot>
                        {p.status || 'active'}
                      </Badge>
                      <span className="text-[var(--fg-subtle)]">{p.task_count || 0} tasks</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card padding="md" className="h-full">
            <CardHeader className="mb-4">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Latest updates</CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-4">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-slate-300 dark:bg-slate-600' : 'bg-brand-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--fg)] truncate">{n.title}</p>
                    <p className="text-xs text-[var(--fg-subtle)] line-clamp-2">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                      {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'just now'}
                    </p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="text-sm text-[var(--fg-subtle)]">No recent activity.</p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card variant="gradient" padding="lg" className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" aria-hidden="true" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-white/80">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Boost productivity</span>
              </div>
              <h3 className="mt-2 text-xl font-semibold text-white">Try the AI Copilot</h3>
              <p className="mt-1 max-w-md text-sm text-white/70">
                Let AI draft task descriptions, summarize updates, and surface what needs your attention.
              </p>
            </div>
            <Button as={Link} to="/app/ai" className="bg-white !text-brand-700 hover:!bg-white/90" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Open AI Copilot
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
