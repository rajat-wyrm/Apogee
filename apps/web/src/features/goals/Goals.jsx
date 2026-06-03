import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { Plus, Target, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Progress } from '../../components/ui/Feedback';
import { formatDate, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Goals() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const goals = useQuery({
    queryKey: ['goals', currentOrganization?.id],
    queryFn: () => api.get(`/goals?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/goals', { ...data, organization_id: currentOrganization.id }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['goals']); setCreateOpen(false); toast.success('Goal created'); },
  });

  const statusColor = { on_track: 'bg-emerald-500', at_risk: 'bg-amber-500', off_track: 'bg-red-500', completed: 'bg-brand-500' };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-sm text-fg-2 mt-0.5">Track objectives and key results</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New goal</button>
      </div>

      {goals.isLoading ? <Loader /> : goals.data?.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set your first goal to start tracking progress" action={<button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New goal</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {goals.data?.map((g) => (
            <Card key={g.id} className="hover:shadow-md transition">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn('h-2 w-2 rounded-full mt-2', statusColor[g.status])} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{g.title}</h3>
                    {g.description && <p className="text-sm text-fg-2 mt-0.5 line-clamp-2">{g.description}</p>}
                    <div className="mt-3 flex items-center gap-3">
                      {g.owner_name && <div className="flex items-center gap-1.5 text-xs text-fg-2"><Avatar name={g.owner_name} src={g.owner_avatar} size="xs" /> {g.owner_name}</div>}
                      {g.end_date && <span className="text-xs text-fg-3">Due {formatDate(g.end_date)}</span>}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-fg-3">Progress</span>
                        <span className="font-medium">{g.progress || 0}%</span>
                      </div>
                      <Progress value={g.progress || 0} color="bg-gradient-to-r from-brand-500 to-purple-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New goal" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button><button form="create-goal" type="submit" className="btn-primary">Create</button></>}>
        <form id="create-goal" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ title: f.get('title'), description: f.get('description'), target_value: f.get('target_value') || 100, metric_type: 'percentage', end_date: f.get('end_date') || null }); }} className="space-y-3">
          <div><label className="label">Title</label><input name="title" required className="input" placeholder="Launch v2.0" /></div>
          <div><label className="label">Description</label><textarea name="description" rows={2} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Target (%)</label><input name="target_value" type="number" defaultValue={100} className="input" /></div>
            <div><label className="label">Due date</label><input name="end_date" type="date" className="input" /></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
