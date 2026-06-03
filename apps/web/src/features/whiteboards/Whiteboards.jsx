import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Whiteboards() {
  const { currentWorkspace } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const boards = useQuery({
    queryKey: ['whiteboards', currentWorkspace?.id],
    queryFn: () => api.get(`/whiteboards?workspace_id=${currentWorkspace.id}`).then((r) => r.data.data),
    enabled: !!currentWorkspace,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/whiteboards', { ...data, workspace_id: currentWorkspace.id }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['whiteboards']); setCreateOpen(false); toast.success('Whiteboard created'); },
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Whiteboards</h1>
          <p className="text-sm text-fg-2 mt-0.5">Visual collaboration and brainstorming</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New whiteboard</button>
      </div>

      {boards.isLoading ? <Loader /> : boards.data?.length === 0 ? (
        <EmptyState icon={Pencil} title="No whiteboards" description="Start sketching and brainstorming visually" action={<button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New whiteboard</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boards.data?.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition cursor-pointer">
              <div className="aspect-video bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/30 dark:to-purple-900/30 rounded-t-xl" />
              <CardContent className="p-4">
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-xs text-fg-3 mt-1">Updated {formatRelative(b.updated_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New whiteboard" size="sm" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button><button form="create-board" type="submit" className="btn-primary">Create</button></>}>
        <form id="create-board" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ title: f.get('title') }); }} className="space-y-3">
          <div><label className="label">Title</label><input name="title" required className="input" placeholder="Brainstorm" autoFocus /></div>
        </form>
      </Modal>
    </div>
  );
}
