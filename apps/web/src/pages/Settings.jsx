import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Building2, ShieldCheck, Bell, Palette, KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Switch } from '../components/ui/Switch';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Separator } from '../components/ui/Separator';
import { PageHeader } from '../components/ui/PageHeader';

export default function Settings() {
  const { user } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.fullName || user?.name || '');

  const { data: orgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });

  const updateProfile = useMutation({
    mutationFn: (payload) => api.put('/users/me', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['organizations']);
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, workspaces and preferences." />

      <Card padding="md">
        <Tabs defaultValue="profile">
          <TabsList variant="underline">
            <TabsTrigger variant="underline" value="profile" leftIcon={<User className="h-4 w-4" />}>Profile</TabsTrigger>
            <TabsTrigger variant="underline" value="workspace" leftIcon={<Building2 className="h-4 w-4" />}>Workspace</TabsTrigger>
            <TabsTrigger variant="underline" value="appearance" leftIcon={<Palette className="h-4 w-4" />}>Appearance</TabsTrigger>
            <TabsTrigger variant="underline" value="notifications" leftIcon={<Bell className="h-4 w-4" />}>Notifications</TabsTrigger>
            <TabsTrigger variant="underline" value="security" leftIcon={<ShieldCheck className="h-4 w-4" />}>Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar name={user?.fullName || user?.name || user?.email} size="2xl" ring />
                <Button variant="outline" size="sm">Change photo</Button>
                <p className="text-xs text-[var(--fg-subtle)]">JPG, PNG up to 2MB</p>
              </div>
              <div className="space-y-4">
                <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Email" value={user?.email || ''} disabled description="Contact support to change your email." />
                <div className="flex justify-end">
                  <Button variant="gradient" loading={updateProfile.isPending} disabled={!name.trim() || name === (user?.fullName || user?.name)} onClick={() => updateProfile.mutate({ fullName: name })}>
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workspace">
            <div className="space-y-3">
              {orgs?.length ? (
                orgs.map((org) => (
                  <div key={org.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300 font-semibold">
                        {org.name?.[0]?.toUpperCase() || 'O'}
                      </span>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-[var(--fg-subtle)]">{org.member_role || 'member'} · {org.member_count || 1} members</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={org.member_role === 'owner' ? 'brand' : 'neutral'} dot>{org.member_role || 'member'}</Badge>
                      <Button variant="outline" size="sm">Manage</Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-[var(--fg-subtle)]">No organizations yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4">
                <div>
                  <p className="font-medium">Dark mode</p>
                  <p className="text-sm text-[var(--fg-subtle)]">Use a darker theme that's easier on the eyes.</p>
                </div>
                <Switch checked={dark} onCheckedChange={toggle} />
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="font-medium">Accent color</p>
                <p className="mt-1 text-sm text-[var(--fg-subtle)]">Personalize the look of your workspace.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['brand', 'accent', 'success', 'warning', 'danger'].map((c) => (
                    <button
                      key={c}
                      className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[var(--bg-elevated)] ${
                        c === 'brand' ? 'bg-brand-600' :
                        c === 'accent' ? 'bg-accent-600' :
                        c === 'success' ? 'bg-success-600' :
                        c === 'warning' ? 'bg-warning-500' : 'bg-danger-600'
                      } ${c === 'brand' ? 'ring-brand-500' : 'ring-transparent'}`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-3">
              {[
                { label: 'Email notifications', description: 'Receive updates about activity in your projects.', default: true },
                { label: 'Push notifications', description: 'Real-time alerts in your browser.', default: true },
                { label: 'Weekly digest', description: 'A summary of the week, delivered on Mondays.', default: false },
                { label: 'Mentions only', description: 'Only notify me when someone @mentions me.', default: false },
              ].map((opt) => (
                <div key={opt.label} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4">
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-sm text-[var(--fg-subtle)]">{opt.description}</p>
                  </div>
                  <Switch defaultChecked={opt.default} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="font-medium">Password</p>
                <p className="mt-1 text-sm text-[var(--fg-subtle)]">Last changed 3 months ago.</p>
                <Button variant="outline" size="sm" className="mt-3" leftIcon={<KeyRound className="h-4 w-4" />}>
                  Change password
                </Button>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="font-medium">Two-factor authentication</p>
                <p className="mt-1 text-sm text-[var(--fg-subtle)]">Add an extra layer of security to your account.</p>
                <Button variant="outline" size="sm" className="mt-3">Enable 2FA</Button>
              </div>
              <div className="rounded-xl border border-danger-200 bg-danger-50/40 p-4 dark:border-danger-500/30 dark:bg-danger-500/5">
                <p className="font-medium text-danger-700 dark:text-danger-300">Danger zone</p>
                <p className="mt-1 text-sm text-[var(--fg-subtle)]">Permanently delete your account and all associated data.</p>
                <Button variant="danger" size="sm" className="mt-3" leftIcon={<Trash2 className="h-4 w-4" />}>
                  Delete account
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}
