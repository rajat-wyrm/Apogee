import { motion } from 'framer-motion';
import { HeadphonesIcon, Plus, MessageCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const TICKETS = [
  { id: 1, subject: 'Cannot login with SSO', requester: 'Sara Lin', status: 'open', priority: 'high', updated: '5m ago' },
  { id: 2, subject: 'Mobile app crashes on launch', requester: 'Marcus Vega', status: 'in_progress', priority: 'urgent', updated: '1h ago' },
  { id: 3, subject: 'How to invite teammates?', requester: 'Priya Anand', status: 'resolved', priority: 'low', updated: '3h ago' },
];

const STATUS_TONES = { open: 'danger', in_progress: 'warning', resolved: 'success', closed: 'neutral' };
const PRIORITY_TONES = { low: 'neutral', medium: 'brand', high: 'warning', urgent: 'danger' };

export default function Helpdesk() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Helpdesk"
        description="Support tickets from your customers and teammates."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New ticket</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Open', value: 12, icon: AlertCircle, tone: 'danger' },
          { label: 'In progress', value: 5, icon: Clock, tone: 'warning' },
          { label: 'Resolved today', value: 8, icon: CheckCircle2, tone: 'success' },
          { label: 'Avg. response', value: '12m', icon: MessageCircle, tone: 'brand' },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">{s.label}</p>
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-${s.tone}-50 text-${s.tone}-600`}>
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card padding="md">
        <h3 className="font-semibold mb-3">Recent tickets</h3>
        {TICKETS.length === 0 ? (
          <EmptyState icon={HeadphonesIcon} title="No tickets" description="All clear. New tickets will appear here." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {TICKETS.map((t) => (
              <li key={t.id} className="flex items-center gap-4 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--fg-muted)] text-xs font-semibold">
                  {t.requester.split(' ').map((p) => p[0]).join('')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-[var(--fg-subtle)]">{t.requester} · {t.updated}</p>
                </div>
                <Badge tone={PRIORITY_TONES[t.priority]} dot>{t.priority}</Badge>
                <Badge tone={STATUS_TONES[t.status]}>{t.status.replace('_', ' ')}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
