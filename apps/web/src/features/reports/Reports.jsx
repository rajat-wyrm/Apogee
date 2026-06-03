import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Loader } from '../../components/ui/Feedback';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Clock, Target } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function Reports() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;

  const overview = useQuery({ queryKey: ['ov', orgId], queryFn: () => api.get(`/analytics/overview?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });
  const trends = useQuery({ queryKey: ['tr', orgId], queryFn: () => api.get(`/analytics/task-trends?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });
  const productivity = useQuery({ queryKey: ['pr', orgId], queryFn: () => api.get(`/analytics/productivity?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });
  const priority = useQuery({ queryKey: ['pd', orgId], queryFn: () => api.get(`/analytics/priority-distribution?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });
  const projectHealth = useQuery({ queryKey: ['ph', orgId], queryFn: () => api.get(`/analytics/project-health?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });
  const workload = useQuery({ queryKey: ['wl', orgId], queryFn: () => api.get(`/analytics/workload?organization_id=${orgId}`).then((r) => r.data.data), enabled: !!orgId });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-fg-2 mt-0.5">Insights and analytics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Active projects" value={overview.data?.active_projects} icon={Target} color="bg-brand-100 text-brand-600" />
        <Stat label="Open tasks" value={overview.data?.total_tasks} icon={Clock} color="bg-amber-100 text-amber-600" />
        <Stat label="Done this week" value={overview.data?.completed_week} icon={TrendingUp} color="bg-emerald-100 text-emerald-600" />
        <Stat label="Members" value={overview.data?.members} icon={Users} color="bg-purple-100 text-purple-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Task completion trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trends.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Priority distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={priority.data || []} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80}>
                    {(priority.data || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Team productivity</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={productivity.data?.slice(0, 8) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="full_name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="assigned" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workload</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={workload.data?.slice(0, 8) || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="full_name" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="open" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Project health</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectHealth.data?.map((p) => {
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm shrink-0" style={{ background: p.color || '#6366f1' }}>{p.icon || p.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-fg-3">{p.done} / {p.total} done · {p.overdue} overdue</div>
                    <div className="mt-1.5 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-semibold w-12 text-right">{pct}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-fg-2">{label}</div>
          <div className="text-2xl font-bold mt-0.5">{value ?? '—'}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}><Icon size={18} /></div>
      </div>
    </div>
  );
}
