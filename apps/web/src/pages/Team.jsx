import { motion } from 'framer-motion';
import { Users, Plus, Mail, Shield, MoreHorizontal } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

const MEMBERS = [
  { name: 'Sara Lin', email: 'sara@apogee.app', role: 'Owner', status: 'active' },
  { name: 'Marcus Vega', email: 'marcus@apogee.app', role: 'Admin', status: 'active' },
  { name: 'Priya Anand', email: 'priya@apogee.app', role: 'Member', status: 'active' },
  { name: 'Tom Chen', email: 'tom@apogee.app', role: 'Member', status: 'pending' },
  { name: 'Olivia Park', email: 'olivia@apogee.app', role: 'Viewer', status: 'active' },
];

const ROLE_TONES = { Owner: 'brand', Admin: 'accent', Member: 'neutral', Viewer: 'neutral' };

export default function Team() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage members and roles."
        action={
          <>
            <Button variant="outline" leftIcon={<Mail className="h-4 w-4" />}>Bulk invite</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Invite member</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Total members</p>
          <p className="mt-2 text-3xl font-bold">{MEMBERS.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Pending invites</p>
          <p className="mt-2 text-3xl font-bold">{MEMBERS.filter((m) => m.status === 'pending').length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Active</p>
          <p className="mt-2 text-3xl font-bold">{MEMBERS.filter((m) => m.status === 'active').length}</p>
        </Card>
      </div>

      {MEMBERS.length === 0 ? (
        <EmptyState icon={Users} title="No team members" description="Invite teammates to collaborate." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Invite member</Button>} />
      ) : (
        <Card padding="none">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold">Members</h3>
            <AvatarGroup size="sm">
              {MEMBERS.slice(0, 5).map((m) => <Avatar key={m.email} name={m.name} />)}
            </AvatarGroup>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {MEMBERS.map((m) => (
              <li key={m.email} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-muted)]/40 transition-colors">
                <Avatar name={m.name} status={m.status === 'active' ? 'online' : 'away'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-[var(--fg-subtle)] truncate">{m.email}</p>
                </div>
                <Badge tone={ROLE_TONES[m.role]}>{m.role}</Badge>
                <Button variant="ghost" size="icon-sm" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </motion.div>
  );
}
