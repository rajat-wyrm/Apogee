import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { cn } from '../lib/utils';

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const unread = notifications.filter((n) => !n.is_read);
  const read = notifications.filter((n) => n.is_read);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay on top of what matters."
        action={
          unread.length > 0 && (
            <Button onClick={() => markAllRead.mutate()} loading={markAllRead.isPending} leftIcon={<CheckCheck className="h-4 w-4" />}>
              Mark all as read
            </Button>
          )
        }
      />

      <Card padding="md">
        <Tabs defaultValue="all">
          <TabsList variant="pills">
            <TabsTrigger variant="pills" value="all">All <Badge tone="neutral" size="sm" className="ml-1">{notifications.length}</Badge></TabsTrigger>
            <TabsTrigger variant="pills" value="unread">Unread <Badge tone="brand" size="sm" className="ml-1">{unread.length}</Badge></TabsTrigger>
            <TabsTrigger variant="pills" value="read">Read</TabsTrigger>
          </TabsList>

          {[
            { value: 'all', items: notifications },
            { value: 'unread', items: unread },
            { value: 'read', items: read },
          ].map(({ value, items }) => (
            <TabsContent key={value} value={value}>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={value === 'unread' ? 'You are all caught up' : 'No notifications'}
                  description={value === 'unread' ? 'No new notifications right now.' : 'When you get notifications, they will show up here.'}
                />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        'flex items-start gap-4 p-4 transition-colors hover:bg-[var(--bg-muted)]/40',
                        !n.is_read && 'bg-brand-50/30 dark:bg-brand-500/5'
                      )}
                    >
                      <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand-500')} />
                      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--fg)]">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-sm text-[var(--fg-subtle)]">{n.body}</p>}
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                          {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : 'just now'}
                        </p>
                      </div>
                      {!n.is_read && (
                        <Button size="xs" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                          Mark read
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </motion.div>
  );
}
