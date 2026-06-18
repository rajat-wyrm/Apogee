import { motion } from 'framer-motion';
import { CreditCard, Download, Sparkles, Check, Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

const INVOICES = [
  { id: 'INV-2024-001', date: 'Oct 1, 2024', amount: 240, status: 'paid' },
  { id: 'INV-2024-002', date: 'Sep 1, 2024', amount: 240, status: 'paid' },
  { id: 'INV-2024-003', date: 'Aug 1, 2024', amount: 240, status: 'paid' },
];

export default function Billing() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="Billing" description="Manage your subscription and invoices." />

      <Card variant="gradient" padding="lg" className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Badge tone="brand" className="bg-white/20 text-white border-white/20" leftIcon={<Sparkles className="h-3 w-3" />}>Current plan</Badge>
            <h3 className="mt-3 text-2xl font-bold text-white">Pro · 20 seats</h3>
            <p className="mt-1 text-sm text-white/80">Renews on November 1, 2024 · $240/mo</p>
          </div>
          <Button className="bg-white !text-brand-700 hover:!bg-white/90">Manage subscription</Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="md">
          <CardHeader className="mb-3">
            <div>
              <CardTitle>Payment method</CardTitle>
              <CardDescription>Update your card or billing details</CardDescription>
            </div>
            <CreditCard className="h-5 w-5 text-[var(--fg-subtle)]" />
          </CardHeader>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-14 items-center justify-center rounded-md gradient-primary text-white text-xs font-bold">VISA</div>
              <div>
                <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                <p className="text-xs text-[var(--fg-subtle)]">Expires 12/27</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </Card>

        <Card padding="md">
          <CardHeader className="mb-3">
            <div>
              <CardTitle>Billing details</CardTitle>
              <CardDescription>Company information on invoices</CardDescription>
            </div>
            <Building2 className="h-5 w-5 text-[var(--fg-subtle)]" />
          </CardHeader>
          <div className="text-sm text-[var(--fg-muted)]">
            <p className="font-medium">Apogee Inc.</p>
            <p>123 Market Street</p>
            <p>San Francisco, CA 94103</p>
            <p>United States</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3">Update</Button>
        </Card>
      </div>

      <Card padding="md">
        <CardHeader className="mb-3">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Download or print past invoices</CardDescription>
          </div>
        </CardHeader>
        <ul className="divide-y divide-[var(--border)]">
          {INVOICES.map((inv) => (
            <li key={inv.id} className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{inv.id}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{inv.date}</p>
              </div>
              <span className="text-sm font-medium tabular-nums">${inv.amount}.00</span>
              <Badge tone="success" dot>paid</Badge>
              <Button variant="ghost" size="icon-sm" aria-label="Download invoice">
                <Download className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </motion.div>
  );
}
