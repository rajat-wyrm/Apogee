import { motion } from 'framer-motion';
import { ShieldCheck, Users, Database, Activity, AlertTriangle, Server } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';

export default function Admin() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Admin"
        description="Workspace administration, security and compliance."
        action={<Badge tone="warning" leftIcon={<AlertTriangle className="h-3 w-3" />}>Admin only</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total users', value: '124', icon: Users, tone: 'brand' },
          { label: 'Storage used', value: '12.4 GB', icon: Database, tone: 'accent' },
          { label: 'API requests (24h)', value: '124.5k', icon: Activity, tone: 'success' },
          { label: 'Server uptime', value: '99.99%', icon: Server, tone: 'warning' },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">{s.label}</p>
                <p className="mt-2 text-2xl font-bold">{s.value}</p>
              </div>
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${s.tone}-50 text-${s.tone}-600`}>
                <s.icon className="h-5 w-5" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="md">
          <h3 className="font-semibold mb-3">Security</h3>
          <div className="space-y-3">
            {[
              { label: 'Two-factor authentication', enabled: true, description: 'Required for all admins.' },
              { label: 'SSO', enabled: false, description: 'Connect your identity provider.' },
              { label: 'Audit logs', enabled: true, description: 'Track every action.' },
              { label: 'IP allowlist', enabled: false, description: 'Restrict access by IP.' },
            ].map((opt) => (
              <div key={opt.label} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-[var(--fg-subtle)]">{opt.description}</p>
                </div>
                <Badge tone={opt.enabled ? 'success' : 'neutral'} dot>{opt.enabled ? 'enabled' : 'disabled'}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <h3 className="font-semibold mb-3">Compliance</h3>
          <div className="space-y-2">
            {[
              { name: 'SOC 2 Type II', status: 'certified' },
              { name: 'GDPR', status: 'compliant' },
              { name: 'HIPAA', status: 'available' },
              { name: 'ISO 27001', status: 'in_progress' },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success-500" />
                  <span className="text-sm font-medium">{c.name}</span>
                </div>
                <Badge tone={c.status === 'in_progress' ? 'warning' : 'success'} dot>{c.status.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
