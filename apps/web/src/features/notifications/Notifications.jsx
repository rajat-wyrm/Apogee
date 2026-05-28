import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useNotificationStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { formatRelative, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { markRead, markAllRead, setUnread } = useNotificationStore();
  const [tab, setTab] = useState('all');

  const notifs = useQuery({
    queryKey: ['notifications', tab],
    queryFn: () => api.get(`/notifications?unread=${tab === 'unread'}`).then((r) => r.data.data),
    refetchInterval: 10000,
  });

  const read = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: (_, id) => { markRead(id); qc.invalidateQueries(['notifications']); },
  });

  const readAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => { markAllRead(); setUnread(0); qc.invalidateQueries(['notifications']); toast.success('Marked all read'); },
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={() => readAll.mutate()} className="btn-secondary btn-sm"><CheckCheck size={14} /> Mark all read</button>
      </div>
      <div className="flex gap-1 mb-4 border-b border-border">
        {['all', 'unread'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-3 py-2 text-sm capitalize border-b-2 -mb-px', tab === t ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-fg-2')}>{t}</button>
        ))}
      </div>
      <Card>
        {notifs.isLoading ? <Loader /> : notifs.data?.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up" />
        ) : (
          <div className="divide-y divide-border -m-5">
            {notifs.data?.map((n) => (
              <div key={n.id} className={cn('flex items-start gap-3 p-4 hover:bg-surface-2 transition cursor-pointer', !n.read_at && 'bg-brand-50/50 dark:bg-brand-900/10')} onClick={() => { if (!n.read_at) read.mutate(n.id); if (n.link) navigate(n.link); }}>
                <div className="h-9 w-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0"><Bell size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body && <div className="text-sm text-fg-2 mt-0.5">{n.body}</div>}
                  <div className="text-xs text-fg-3 mt-1">{formatRelative(n.created_at)}</div>
                </div>
                <div className="flex items-center gap-1">
                  {!n.read_at && <button onClick={(e) => { e.stopPropagation(); read.mutate(n.id); }} className="btn-icon btn-ghost"><Check size={14} /></button>}
                  <button onClick={(e) => { e.stopPropagation(); del.mutate(n.id); }} className="btn-icon btn-ghost"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
