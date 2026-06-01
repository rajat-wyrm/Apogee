import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Plus, FileText, Search, Star, Clock } from 'lucide-react';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function DocumentsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthStore();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const docs = useQuery({
    queryKey: ['documents', currentWorkspace?.id],
    queryFn: () => api.get(`/documents?workspace_id=${currentWorkspace.id}`).then((r) => r.data.data),
    enabled: !!currentWorkspace,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/documents', { ...data, workspace_id: currentWorkspace.id }).then((r) => r.data.data),
    onSuccess: (d) => { qc.invalidateQueries(['documents']); navigate(`/app/documents/${d.id}`); },
  });

  const filtered = docs.data?.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-fg-2 mt-0.5">Your team's knowledge base</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New document</button>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="input pl-9" />
      </div>

      {docs.isLoading ? <Loader /> : filtered?.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Create your first document to get started"
          action={<button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New document</button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered?.map((d) => (
            <button key={d.id} onClick={() => navigate(`/app/documents/${d.id}`)} className="card-hover p-4 text-left group">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-600 flex items-center justify-center text-xl shrink-0">
                  {d.icon || '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate group-hover:text-brand-600 transition">{d.title}</h3>
                  <p className="text-xs text-fg-3 mt-0.5 line-clamp-2">{d.content_text?.slice(0, 100) || 'Empty document'}</p>
                  <div className="text-[10px] text-fg-3 mt-2 flex items-center gap-1"><Clock size={10} /> {formatRelative(d.updated_at)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New document"
        size="sm"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button form="create-doc" type="submit" className="btn-primary">Create</button>
          </>
        }
      >
        <form id="create-doc" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ title: f.get('title'), icon: f.get('icon') || '📄' }); }} className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input name="title" required className="input" placeholder="Untitled" autoFocus />
          </div>
          <div>
            <label className="label">Icon</label>
            <input name="icon" defaultValue="📄" className="input" maxLength={2} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
