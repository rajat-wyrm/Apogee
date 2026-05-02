import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarGroup } from './Avatar';
import api from '../../lib/api';
import { useEffect, useRef, useState } from 'react';
import { formatRelative, cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, Inbox, Sparkles, FileText, ListTodo, FolderKanban, MessageCircle, AtSign, User } from 'lucide-react';

const iconFor = (type) => {
  if (type === 'mention' || type === 'comment') return MessageCircle;
  if (type === 'assigned') return User;
  if (type === 'task' || type === 'task.created') return ListTodo;
  if (type === 'project') return FolderKanban;
  if (type === 'document') return FileText;
  return Bell;
};

const colorFor = (type) => {
  if (type === 'mention') return 'bg-brand-100 dark:bg-brand-900/30 text-brand-600';
  if (type === 'assigned') return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600';
  if (type?.startsWith('task')) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600';
  if (type?.startsWith('project')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600';
  if (type?.startsWith('document')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600';
  return 'bg-surface-3 text-fg-2';
};

export function NotificationsPanel({ onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=20').then((r) => r.data.data || []),
  });
  const ref = useRef(null);
  const read = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: (_, id) => { qc.invalidateQueries(['notifications']); },
  });
  const readAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => { qc.invalidateQueries(['notifications']); },
  });

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-default bg-surface shadow-2xl z-50 animate-slide-down overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-default bg-surface-2">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <button onClick={() => readAll.mutate()} className="text-xs text-fg-2 hover:text-fg-3 inline-flex items-center gap-1">
          <CheckCheck size={12} /> Mark all read
        </button>
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2 p-2">
                <div className="skeleton skeleton-circle h-8 w-8" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton skeleton-text w-3/4" />
                  <div className="skeleton skeleton-text w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox size={32} className="mx-auto text-fg-3 mb-2" />
            <p className="text-sm text-fg-3">All caught up</p>
          </div>
        ) : (
          data?.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <button
                key={n.id}
                onClick={() => { if (!n.read_at) read.mutate(n.id); if (n.link) { navigate(n.link); onClose?.(); } }}
                className={cn('w-full text-left flex gap-2 p-3 hover:bg-surface-2 border-b border-default last:border-0 transition', !n.read_at && 'bg-brand-50/50 dark:bg-brand-900/10')}
              >
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', colorFor(n.type))}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-fg-3 line-clamp-2 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-fg-3 mt-1">{formatRelative(n.created_at)}</div>
                </div>
                {!n.read_at && <span className="h-2 w-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
      <div className="p-2 border-t border-default bg-surface-2 text-center">
        <button onClick={() => { navigate('/app/notifications'); onClose?.(); }} className="text-xs link">View all notifications</button>
      </div>
    </div>
  );
}
