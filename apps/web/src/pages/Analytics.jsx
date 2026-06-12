import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, Activity, Clock, Users } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { cn } from '../lib/utils';

const COLORS = ['#3b62ff', '#a855f7', '#10b981', '#f59e0b', '#ef4444'];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-large">
      {label && <p className="text-xs font-medium text-[var(--fg-subtle)] mb-1">{label}</p>}
      {payload.map((p, idx) => (
        <p key={idx} className="text-sm text-[var(--fg)]">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function StatBlock({ icon: Icon, label, value, tone = 'brand' }) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        </div>
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
      </div>
    </Card>
  );
}

function ChartSkeleton({ h = 200 }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="w-full" style={{ height: h }} />
    </div>
  );
}

export default function Analytics() {
  const { selectedOrgId } = useOrgStore();

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics', 'task-trends', selectedOrgId],
    queryFn: () => api.get('/analytics/task-trends', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  const { data: productivity, isLoading: productivityLoading } = useQuery({
    queryKey: ['analytics', 'productivity', selectedOrgId],
    queryFn: () => api.get('/analytics/productivity', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  const { data: weekly } = useQuery({
    queryKey: ['analytics', 'weekly-activity', selectedOrgId],
    queryFn: () => api.get('/analytics/weekly-activity', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  const { data: priorityDist } = useQuery({
    queryKey: ['analytics', 'priority-distribution', selectedOrgId],
    queryFn: () => api.get('/analytics/priority-distribution', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  const { data: projectHealth } = useQuery({
    queryKey: ['analytics', 'project-health', selectedOrgId],
    queryFn: () => api.get('/analytics/project-health', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  if (!selectedOrgId) {
    return <EmptyState icon={BarChart3} tone="brand" title="Select an organization" description="Pick an organization from the sidebar to view analytics." />;
  }

  const totalTasks = productivity?.reduce((sum, p) => sum + (p.completed_tasks || 0), 0) || 0;
  const totalActive = productivity?.length || 0;
  const completed = trends?.reduce((s, t) => s + (t.completed || 0), 0) || 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Analytics"
          description="Real-time insights into your team's productivity."
        />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock icon={CheckCircle2} label="Tasks completed" value={completed} tone="success" />
        <StatBlock icon={Activity} label="Total activity" value={weekly?.reduce((s, w) => s + (w.actions || 0), 0) || 0} tone="brand" />
        <StatBlock icon={Users} label="Active members" value={totalActive} tone="accent" />
        <StatBlock icon={TrendingUp} label="Completion rate" value={`${totalTasks > 0 ? Math.round((completed / Math.max(totalTasks, completed)) * 100) : 0}%`} tone="warning" />
      </motion.div>

      <motion.div variants={item}>
        <Card padding="md">
          <Tabs defaultValue="trends">
            <TabsList variant="pills">
              <TabsTrigger variant="pills" value="trends">Task trends</TabsTrigger>
              <TabsTrigger variant="pills" value="weekly">Weekly activity</TabsTrigger>
              <TabsTrigger variant="pills" value="priority">Priority</TabsTrigger>
              <TabsTrigger variant="pills" value="productivity">Productivity</TabsTrigger>
            </TabsList>

            <TabsContent value="trends">
              {trendsLoading ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trends || []}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b62ff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3b62ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="completed" name="Completed" stroke="#3b62ff" strokeWidth={2} fill="url(#trendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            <TabsContent value="weekly">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekly || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--fg-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="actions" name="Actions" fill="#a855f7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="priority">
              <div className="grid gap-6 md:grid-cols-2">
                {priorityDist ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={priorityDist} dataKey="count" nameKey="priority" innerRadius={60} outerRadius={100} paddingAngle={4} label>
                        {priorityDist.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--fg-muted)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <ChartSkeleton />}
                <div className="space-y-3">
                  {(priorityDist || []).map((p, i) => (
                    <div key={p.priority} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{p.priority}</span>
                        <span className="tabular-nums text-[var(--fg-muted)]">{p.count}</span>
                      </div>
                      <Progress
                        value={(p.count / Math.max(1, priorityDist?.reduce((s, x) => s + x.count, 0) || 1)) * 100}
                        tone={['brand', 'warning', 'danger'][i] || 'brand'}
                        className="mt-2"
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="productivity">
              {productivityLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !productivity?.length ? (
                <p className="py-8 text-center text-sm text-[var(--fg-subtle)]">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {productivity.map((u) => (
                    <div key={u.full_name} className="flex items-center gap-4 rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--bg-muted)]/40 transition-colors">
                      <span className="flex-1 text-sm font-medium">{u.full_name}</span>
                      <div className="flex items-center gap-3">
                        <Badge tone="success" dot>{u.completed_tasks} completed</Badge>
                        <span className="text-xs text-[var(--fg-subtle)]">{u.assigned_tasks || 0} assigned</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card padding="md">
          <CardHeader className="mb-3">
            <div>
              <CardTitle>Project health</CardTitle>
              <CardDescription>Completion across active projects</CardDescription>
            </div>
          </CardHeader>
          {!projectHealth ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : projectHealth.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--fg-subtle)]">No projects yet.</p>
          ) : (
            <div className="space-y-3">
              {projectHealth.map((p) => {
                const pct = p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0;
                return (
                  <div key={p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="tabular-nums text-[var(--fg-muted)]">{p.completed_tasks}/{p.total_tasks} · {pct}%</span>
                    </div>
                    <Progress value={pct} tone={pct >= 80 ? 'success' : pct >= 40 ? 'brand' : 'warning'} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
