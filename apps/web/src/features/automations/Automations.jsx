import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Plus, Workflow, Zap, Webhook, Bell, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

const TRIGGERS = [
  { value: 'task_created', label: 'Task created' },
  { value: 'task_completed', label: 'Task completed' },
  { value: 'task_assigned', label: 'Task assigned' },
  { value: 'task_overdue', label: 'Task overdue' },
  { value: 'comment_added', label: 'Comment added' },
  { value: 'status_changed', label: 'Status changed' },
];

const ACTIONS = [
  { value: 'send_notification', label: 'Send notification' },
  { value: 'send_email', label: 'Send email' },
  { value: 'assign_user', label: 'Assign to user' },
  { value: 'set_status', label: 'Set status' },
  { value: 'set_priority', label: 'Set priority' },
  { value: 'add_label', label: 'Add label' },
  { value: 'call_webhook', label: 'Call webhook' },
];

export default function Automations() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value });

  const automations = useQuery({
    queryKey: ['automations', currentOrganization?.id],
    queryFn: () => api.get(`/automations?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/automations', { ...data, organization_id: currentOrganization.id, trigger: { type: data.trigger, config: {} }, actions: [{ type: data.action, config: {} }] }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['automations']); setCreateOpen(false); toast.success('Automation created'); setForm({ name: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value }); },
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-sm text-fg-2 mt-0.5">Build no-code workflows</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New automation</button>
      </div>

      {automations.isLoading ? <Loader /> : automations.data?.length === 0 ? (
        <EmptyState icon={Workflow} title="No automations" description="Automate repetitive work to save time" action={<button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New automation</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {automations.data?.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-600 flex items-center justify-center">
                      <Zap size={16} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{a.name}</h3>
                      <p className="text-xs text-fg-3">{a.run_count || 0} runs</p>
                    </div>
                  </div>
                  <span className={`badge ${a.enabled ? 'badge-success' : 'badge-gray'}`}>{a.enabled ? 'Active' : 'Paused'}</span>
                </div>
                <div className="mt-3 text-xs text-fg-2 flex items-center gap-1.5">
                  <span className="badge badge-brand">{a.trigger?.type}</span>
                  <span>→</span>
                  <span className="badge badge-gray">{a.actions?.[0]?.type}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New automation" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button><button onClick={() => create.mutate(form)} className="btn-primary">Create</button></>}>
        <div className="space-y-3">
          <div><label className="label">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Notify on overdue" /></div>
          <div><label className="label">When…</label><select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="input">{TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="label">Then…</label><select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="input">{ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
        </div>
      </Modal>
    </div>
  );
}
