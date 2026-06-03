import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Plus, Ticket, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { formatRelative, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default function Helpdesk() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState('open');

  const tickets = useQuery({
    queryKey: ['tickets', currentOrganization?.id],
    queryFn: () => api.get(`/helpdesk?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/helpdesk', { ...data, organization_id: currentOrganization.id }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries(['tickets']); setCreateOpen(false); toast.success('Ticket created'); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/helpdesk/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries(['tickets']),
  });

  const filtered = tickets.data?.filter((t) => filter === 'all' || t.status === filter);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Helpdesk</h1>
          <p className="text-sm text-fg-2 mt-0.5">Customer support tickets</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New ticket</button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {['all', ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('btn-secondary btn-sm capitalize', filter === s && 'bg-brand-100 text-brand-700 dark:bg-brand-900/30')}>{s}</button>
        ))}
      </div>

      {tickets.isLoading ? <Loader /> : filtered?.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets" description="All clear! No support tickets here." />
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {filtered?.map((t) => (
              <div key={t.id} className="p-4 flex items-center gap-3 hover:bg-surface-2 transition">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', t.priority === 'urgent' ? 'bg-red-100 text-red-600' : t.priority === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-surface-3 text-fg-2')}>
                  <Ticket size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.subject}</div>
                  <div className="text-xs text-fg-3 mt-0.5 line-clamp-1">{t.description}</div>
                </div>
                <select value={t.status} onChange={(e) => update.mutate({ id: t.id, status: e.target.value })} className="input w-auto text-xs">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className={cn('badge', t.priority === 'urgent' ? 'badge-danger' : t.priority === 'high' ? 'badge-warning' : 'badge-gray')}>{t.priority}</span>
                <span className="text-xs text-fg-3 w-20 text-right">{formatRelative(t.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New ticket" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button><button form="create-ticket" type="submit" className="btn-primary">Create</button></>}>
        <form id="create-ticket" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ subject: f.get('subject'), description: f.get('description'), priority: f.get('priority') }); }} className="space-y-3">
          <div><label className="label">Subject</label><input name="subject" required className="input" placeholder="Brief summary" /></div>
          <div><label className="label">Description</label><textarea name="description" rows={3} className="input" /></div>
          <div><label className="label">Priority</label><select name="priority" className="input" defaultValue="normal">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
        </form>
      </Modal>
    </div>
  );
}
