import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { Search, ListTodo, FolderKanban, FileText, User } from 'lucide-react';

export default function SearchResults() {
  const [params] = useSearchParams();
  const { currentOrganization } = useAuthStore();
  const [q, setQ] = useState(params.get('q') || '');

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const results = useQuery({
    queryKey: ['search', q, currentOrganization?.id],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(q)}&organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!q && q.length >= 2 && !!currentOrganization,
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything…" className="input pl-9" />
      </div>
      {!q || q.length < 2 ? <EmptyState icon={Search} title="Type to search" description="Find projects, tasks, documents, and people" /> : results.isLoading ? <Loader /> : (
        <div className="space-y-4">
          {results.data?.tasks?.length > 0 && (
            <Section icon={ListTodo} title={`Tasks (${results.data.tasks.length})`}>
              {results.data.tasks.map((t) => (
                <Link key={t.id} to={`/app/projects/${t.project_id}?task=${t.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-2 transition">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.project_color || '#6366f1' }} />
                  <div className="flex-1"><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-fg-3">{t.project_name}</div></div>
                  <span className="badge badge-gray capitalize">{t.priority}</span>
                </Link>
              ))}
            </Section>
          )}
          {results.data?.projects?.length > 0 && (
            <Section icon={FolderKanban} title={`Projects (${results.data.projects.length})`}>
              {results.data.projects.map((p) => (
                <Link key={p.id} to={`/app/projects/${p.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-2 transition">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ background: p.color || '#6366f1' }}>{p.icon || p.name[0]}</div>
                  <div className="flex-1"><div className="text-sm font-medium">{p.name}</div>{p.description && <div className="text-xs text-fg-3 line-clamp-1">{p.description}</div>}</div>
                </Link>
              ))}
            </Section>
          )}
          {results.data?.documents?.length > 0 && (
            <Section icon={FileText} title={`Documents (${results.data.documents.length})`}>
              {results.data.documents.map((d) => (
                <Link key={d.id} to={`/app/documents/${d.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-2 transition">
                  <div className="text-xl">{d.icon || '📄'}</div>
                  <div className="text-sm font-medium">{d.title}</div>
                </Link>
              ))}
            </Section>
          )}
          {results.data?.users?.length > 0 && (
            <Section icon={User} title={`People (${results.data.users.length})`}>
              {results.data.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-2">
                  <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                  <div className="flex-1"><div className="text-sm font-medium">{u.full_name}</div><div className="text-xs text-fg-3">{u.email}</div></div>
                </div>
              ))}
            </Section>
          )}
          {Object.values(results.data || {}).every((arr) => arr?.length === 0) && <EmptyState icon={Search} title="No results" description={`Nothing matches "${q}"`} />}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <Card>
      <div className="p-4 border-b border-border flex items-center gap-2 text-sm font-semibold"><Icon size={14} /> {title}</div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}
