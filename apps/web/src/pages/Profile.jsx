import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Mail, Calendar, MapPin, Briefcase, Globe, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { PageHeader } from '../components/ui/PageHeader';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => api.get('/users/me/stats').then((r) => r.data).catch(() => ({ projects: 0, tasks: 0, completed: 0 })),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="h-32 gradient-primary" />
        <div className="px-6 pb-6 -mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar name={user?.fullName || user?.name || user?.email} size="2xl" ring className="-mt-2 ring-4 ring-[var(--bg-elevated)]" />
            <div className="pb-1">
              <h2 className="text-2xl font-bold">{user?.fullName || user?.name || 'Your name'}</h2>
              <p className="text-sm text-[var(--fg-subtle)]">{user?.email}</p>
            </div>
          </div>
          <Button variant={editing ? 'primary' : 'outline'} leftIcon={<Edit3 className="h-4 w-4" />} onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel' : 'Edit profile'}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Projects</p>
          <p className="mt-2 text-3xl font-bold">{stats?.projects ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Tasks</p>
          <p className="mt-2 text-3xl font-bold">{stats?.tasks ?? 0}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Completed</p>
          <p className="mt-2 text-3xl font-bold">{stats?.completed ?? 0}</p>
        </Card>
      </div>

      <Card padding="md">
        <Tabs defaultValue="about">
          <TabsList variant="pills">
            <TabsTrigger variant="pills" value="about">About</TabsTrigger>
            <TabsTrigger variant="pills" value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="about">
            {editing ? (
              <div className="space-y-4 max-w-xl">
                <Input label="Full name" defaultValue={user?.fullName || user?.name || ''} />
                <Input label="Headline" placeholder="e.g. Head of Product" />
                <Textarea label="Bio" placeholder="Tell your team about yourself" rows={4} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Location" placeholder="San Francisco, CA" leftIcon={<MapPin className="h-4 w-4" />} />
                  <Input label="Website" placeholder="https://yoursite.com" leftIcon={<Globe className="h-4 w-4" />} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button variant="gradient">Save changes</Button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Email</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-[var(--fg-subtle)]" /> {user?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Member since</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm"><Calendar className="h-3.5 w-3.5 text-[var(--fg-subtle)]" /> {user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'Recently'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Role</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm"><Briefcase className="h-3.5 w-3.5 text-[var(--fg-subtle)]" /> {user?.role || 'Member'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Status</dt>
                  <dd className="mt-1"><Badge tone="success" dot>Active</Badge></dd>
                </div>
              </dl>
            )}
          </TabsContent>
          <TabsContent value="activity">
            <p className="py-8 text-center text-sm text-[var(--fg-subtle)]">Activity feed coming soon.</p>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}
