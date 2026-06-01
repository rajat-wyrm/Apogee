import { useQuery } from '@tanstack/react-query';
import { Routes, Route, NavLink } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Loader } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { Users, FileText, Flag, Activity } from 'lucide-react';
import { cn, formatRelative } from '../../lib/utils';

export default function Admin() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <div className="flex flex-col md:flex-row gap-4">
        <nav className="md:w-48 shrink-0 space-y-0.5">
          {[
            { to: 'users', label: 'Users', icon: Users },
            { to: 'audit', label: 'Audit logs', icon: FileText },
            { to: 'features', label: 'Feature flags', icon: Flag },
            { to: 'webhooks', label: 'Webhooks', icon: Activity },
          ].map((s) => (
            <NavLink key={s.to} to={s.to} className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}>
              <s.icon size={14} /> {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<AdminUsers />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="features" element={<FeatureFlags />} />
            <Route path="webhooks" element={<Webhooks />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;
  const users = useQuery({
    queryKey: ['admin-users', orgId],
    queryFn: () => api.get(`/admin/users?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Users</CardTitle></CardHeader>
      <CardContent>
        {users.isLoading ? <Loader /> : (
          <div className="divide-y divide-border -m-5">
            {users.data?.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-4">
                <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.full_name}</div>
                  <div className="text-xs text-fg-3 truncate">{u.email}</div>
                </div>
                <span className="badge badge-gray capitalize">{u.role}</span>
                <span className="text-xs text-fg-3 w-24 text-right">{u.last_active_at ? `Active ${formatRelative(u.last_active_at)}` : 'Never'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogs() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;
  const logs = useQuery({
    queryKey: ['audit', orgId],
    queryFn: () => api.get(`/admin/audit-logs?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Audit logs</CardTitle></CardHeader>
      <CardContent>
        {logs.isLoading ? <Loader /> : (
          <div className="space-y-1.5">
            {logs.data?.slice(0, 50).map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm py-1.5">
                <Avatar name={l.actor_name} src={l.actor_avatar} size="xs" />
                <span className="font-medium">{l.actor_name || 'System'}</span>
                <span className="text-fg-3">{l.action}</span>
                <span className="text-fg-2">{l.entity_type}</span>
                <span className="ml-auto text-xs text-fg-3">{formatRelative(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureFlags() {
  const flags = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.get('/admin/feature-flags').then((r) => r.data.data),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Feature flags</CardTitle></CardHeader>
      <CardContent>
        {flags.isLoading ? <Loader /> : (
          <div className="space-y-2">
            {flags.data?.map((f) => (
              <div key={f.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <div className="text-sm font-medium">{f.key}</div>
                  <div className="text-xs text-fg-3">{f.description || 'No description'}</div>
                </div>
                <span className={f.enabled ? 'badge badge-success' : 'badge badge-gray'}>{f.enabled ? 'On' : 'Off'}</span>
              </div>
            ))}
            {flags.data?.length === 0 && <p className="text-sm text-fg-3 text-center py-4">No feature flags configured</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Webhooks() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;
  const hooks = useQuery({
    queryKey: ['webhooks', orgId],
    queryFn: () => api.get(`/webhooks?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });
  return (
    <Card>
      <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
      <CardContent>
        {hooks.isLoading ? <Loader /> : (
          <div className="space-y-2">
            {hooks.data?.map((w) => (
              <div key={w.id} className="p-3 rounded-lg border border-border">
                <div className="text-sm font-mono truncate">{w.url}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.events?.map((e) => <span key={e} className="badge badge-brand text-[10px]">{e}</span>)}
                </div>
              </div>
            ))}
            {hooks.data?.length === 0 && <p className="text-sm text-fg-3 text-center py-4">No webhooks yet</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
