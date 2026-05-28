import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { Plus, Calendar as CalIcon, Clock, MapPin } from 'lucide-react';
import { formatDate, formatTime, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Calendar() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const events = useQuery({
    queryKey: ['events', currentOrganization?.id, month, year],
    queryFn: () => api.get(`/calendar?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/calendar', { ...data, organization_id: currentOrganization.id }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['events']); setCreateOpen(false); toast.success('Event created'); },
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const dayEvents = (d) => events.data?.filter((e) => {
    const dt = new Date(e.start_at);
    return dt.getDate() === d && dt.getMonth() === month && dt.getFullYear() === year;
  }) || [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-fg-2 mt-0.5">Events, milestones, and reminders</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus size={14} /> New event</button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-1">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(month - 1); }} className="btn-icon btn-ghost">‹</button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} className="btn-secondary btn-sm">Today</button>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(month + 1); }} className="btn-icon btn-ghost">›</button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-7 text-xs text-fg-3 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="p-2 text-center font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const evs = dayEvents(d);
            return (
              <div key={i} className={cn('border-b border-r border-border p-1.5 min-h-[100px]', !d && 'bg-surface-2')}>
                {d && <div className={cn('text-xs', d === today.getDate() && month === today.getMonth() && year === today.getFullYear() && 'text-brand-600 font-semibold')}>{d}</div>}
                <div className="space-y-1 mt-1">
                  {evs.slice(0, 3).map((e) => (
                    <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded truncate" style={{ background: (e.color || '#6366f1') + '22', color: e.color || '#6366f1' }}>
                      {formatTime(e.start_at)} {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Upcoming events</CardTitle></CardHeader>
        <CardContent>
          {events.data?.filter((e) => new Date(e.start_at) >= today).slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: (e.color || '#6366f1') + '22' }}>
                <CalIcon size={16} style={{ color: e.color || '#6366f1' }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{e.title}</div>
                <div className="text-xs text-fg-3 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(e.start_at)} {formatTime(e.start_at)}</span>
                  {e.location && <span className="flex items-center gap-1"><MapPin size={10} /> {e.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New event" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button><button form="create-event" type="submit" className="btn-primary">Create</button></>}>
        <form id="create-event" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ title: f.get('title'), start_at: f.get('start_at'), end_at: f.get('end_at') || null, location: f.get('location'), color: f.get('color') }); }} className="space-y-3">
          <div><label className="label">Title</label><input name="title" required className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input name="start_at" type="datetime-local" required className="input" /></div>
            <div><label className="label">End</label><input name="end_at" type="datetime-local" className="input" /></div>
          </div>
          <div><label className="label">Location</label><input name="location" className="input" /></div>
          <div><label className="label">Color</label><input name="color" type="color" defaultValue="#6366f1" className="input h-10 p-1" /></div>
        </form>
      </Modal>
    </div>
  );
}
