import { motion } from 'framer-motion';
import { Workflow, Plus, Zap, ArrowRight, Clock, Play, Pause } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Switch } from '../components/ui/Switch';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const RULES = [
  { id: 1, name: 'Auto-assign new tasks', trigger: 'When task is created', action: 'Assign to project lead', runs: 124, active: true },
  { id: 2, name: 'Slack notification on mention', trigger: 'When user is mentioned', action: 'Send Slack DM', runs: 58, active: true },
  { id: 3, name: 'Archive completed projects', trigger: 'When all tasks completed', action: 'Archive project', runs: 12, active: false },
  { id: 4, name: 'Daily standup digest', trigger: 'Every weekday at 9am', action: 'Send email summary', runs: 47, active: true },
];

export default function Automations() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Automations"
        description="Build no-code rules to remove busywork."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New automation</Button>}
      />

      <Card variant="gradient" padding="lg" className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-white/80">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Automate everything</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">Connect triggers to actions</h3>
            <p className="mt-1 max-w-md text-sm text-white/70">No-code rules that respond to events in your workspace. Save hours every week.</p>
          </div>
          <Button className="bg-white !text-brand-700 hover:!bg-white/90">Browse templates</Button>
        </div>
      </Card>

      {RULES.length === 0 ? (
        <EmptyState icon={Workflow} title="No automations yet" description="Create your first rule to start automating." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Create automation</Button>} />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-[var(--border)]">
            {RULES.map((r) => (
              <li key={r.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-muted)]/40 transition-colors">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300">
                  <Workflow className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
                    <span>{r.trigger}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{r.action}</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--fg-subtle)] hidden sm:block">{r.runs} runs</div>
                <Badge tone={r.active ? 'success' : 'neutral'} dot>{r.active ? 'active' : 'paused'}</Badge>
                <Switch defaultChecked={r.active} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </motion.div>
  );
}
