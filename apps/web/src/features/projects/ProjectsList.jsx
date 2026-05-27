import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal, Confirm } from '../../components/ui/Modal';
import { Loader, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Plus, Search, MoreVertical, FolderKanban, Target, Users, Archive, Trash2 } from 'lucide-react';
import { AvatarGroup } from '../../components/ui/Avatar';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function ProjectsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id;
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState('grid');

  const projects = useQuery({
    queryKey: ['projects', wsId],
    queryFn: () => api.get(`/projects?workspace_id=${wsId}`).then((r) => r.data.data),
    enabled: !!wsId,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/projects', { ...data, workspace_id: wsId }).then((r) => r.data.data),
    onSuccess: (p) => {
      qc.invalidateQueries(['projects']);
      toast.success('Project created');
      setCreateOpen(false);
      navigate(`/app/projects/${p.id}`);
    },
  });

  const filtered = projects.data?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-fg-2 mt-0.5">Organize work into focused initiatives</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New project</button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="input pl-9" />
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button onClick={() => setView('grid')} className={`px-3 py-1.5 text-sm ${view === 'grid' ? 'bg-surface-3' : ''}`}>Grid</button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-surface-3' : ''}`}>List</button>
        </div>
      </div>

      {projects.isLoading ? <Loader /> : filtered?.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={search ? 'No projects match' : 'No projects yet'}
          description={search ? 'Try a different search' : 'Create your first project to start tracking work'}
          action={!search && <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New project</button>}
        />
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered?.map((p) => (
            <Link key={p.id} to={`/app/projects/${p.id}`} className="card-hover p-4 group">
              <div className="flex items-start justify-between mb-2">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg" style={{ background: p.color || '#6366f1' }}>
                  {p.icon || p.name[0]?.toUpperCase()}
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="btn-icon btn-ghost opacity-0 group-hover:opacity-100"><MoreVertical size={14} /></button>
              </div>
              <h3 className="font-semibold group-hover:text-brand-600 transition">{p.name}</h3>
              {p.description && <p className="text-xs text-fg-2 mt-1 line-clamp-2">{p.description}</p>}
              <div className="mt-3">
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all" style={{ width: `${p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-fg-3">
                  <span>{p.task_count || 0} tasks · {Math.round(((p.done_count || 0) / Math.max(1, p.task_count || 0)) * 100)}% done</span>
                  <span>{formatRelative(p.updated_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-fg-3">
              <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Status</th><th className="text-left p-3">Tasks</th><th className="text-left p-3">Updated</th></tr>
            </thead>
            <tbody>
              {filtered?.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-surface-2 cursor-pointer" onClick={() => navigate(`/app/projects/${p.id}`)}>
                  <td className="p-3 font-medium flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">{p.task_count || 0}</td>
                  <td className="p-3 text-fg-3">{formatRelative(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New project"
        description="Create a focused workspace for your work"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button form="create-project" type="submit" disabled={create.isLoading} className="btn-primary">
              {create.isLoading ? <span className="loader" /> : 'Create project'}
            </button>
          </>
        }
      >
        <form id="create-project" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ name: f.get('name'), description: f.get('description'), color: f.get('color') || '#6366f1', icon: f.get('icon'), view_type: f.get('view_type') || 'kanban' }); }} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Q3 launch" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" rows={3} className="input" placeholder="What's this project about?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Color</label>
              <input name="color" type="color" defaultValue="#6366f1" className="input h-10 p-1" />
            </div>
            <div>
              <label className="label">Icon (emoji)</label>
              <input name="icon" defaultValue="📋" className="input" maxLength={2} />
            </div>
          </div>
          <div>
            <label className="label">Default view</label>
            <select name="view_type" className="input" defaultValue="kanban">
              <option value="kanban">Kanban</option>
              <option value="list">List</option>
              <option value="calendar">Calendar</option>
              <option value="timeline">Timeline</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
