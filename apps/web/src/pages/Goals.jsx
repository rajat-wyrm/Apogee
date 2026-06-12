import { motion } from 'framer-motion';
import { Target, Plus, TrendingUp, Sparkles, MoreVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const GOALS = [
  { id: 1, title: 'Ship v2.0 of Apogee', progress: 78, status: 'on_track', dueDate: 'Dec 31', keyResults: 4, completed: 3 },
  { id: 2, title: 'Reach 10k active users', progress: 45, status: 'at_risk', dueDate: 'Jan 15', keyResults: 3, completed: 1 },
  { id: 3, title: 'Improve NPS to 60', progress: 92, status: 'on_track', dueDate: 'Nov 30', keyResults: 5, completed: 4 },
  { id: 4, title: 'Reduce churn by 25%', progress: 30, status: 'off_track', dueDate: 'Mar 1', keyResults: 4, completed: 1 },
];

const STATUS_TONES = { on_track: 'success', at_risk: 'warning', off_track: 'danger', completed: 'brand' };

export default function Goals() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Goals"
        description="Set OKRs and track progress towards what matters most."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New goal</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Total goals</p>
          <p className="mt-2 text-3xl font-bold">{GOALS.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">On track</p>
          <p className="mt-2 text-3xl font-bold text-success-600">{GOALS.filter((g) => g.status === 'on_track').length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Avg progress</p>
          <p className="mt-2 text-3xl font-bold">{Math.round(GOALS.reduce((s, g) => s + g.progress, 0) / GOALS.length)}%</p>
        </Card>
      </div>

      {GOALS.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Set your first OKR to align your team." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Create goal</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {GOALS.map((g) => (
            <Card key={g.id} padding="md" interactive>
              <CardHeader className="mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300">
                    <Target className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle>{g.title}</CardTitle>
                    <CardDescription>Due {g.dueDate} · {g.completed}/{g.keyResults} key results</CardDescription>
                  </div>
                </div>
                <Badge tone={STATUS_TONES[g.status]} dot>{g.status.replace('_', ' ')}</Badge>
              </CardHeader>
              <Progress
                value={g.progress}
                tone={g.status === 'off_track' ? 'danger' : g.status === 'at_risk' ? 'warning' : 'success'}
                showLabel
              />
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
