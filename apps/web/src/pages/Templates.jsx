import { motion } from 'framer-motion';
import { LayoutTemplate, Plus, Star } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const TEMPLATES = [
  { name: 'Product launch', category: 'Marketing', description: 'Complete project plan from ideation to launch.', uses: 1240, featured: true, tone: 'brand' },
  { name: 'Sprint planning', category: 'Engineering', description: 'Two-week sprint with backlog grooming and retros.', uses: 850, tone: 'accent' },
  { name: 'Customer onboarding', category: 'Success', description: 'Welcome new customers with a guided journey.', uses: 620, tone: 'success' },
  { name: 'Content calendar', category: 'Marketing', description: 'Plan and track content across all channels.', uses: 540, tone: 'warning' },
  { name: 'Bug triage', category: 'Engineering', description: 'Triage, prioritize and fix bugs faster.', uses: 480, tone: 'danger' },
  { name: 'Hiring pipeline', category: 'People', description: 'End-to-end hiring process from sourcing to offer.', uses: 320, tone: 'accent' },
];

export default function Templates() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Templates"
        description="Pre-built templates to get started faster."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New template</Button>}
      />

      {TEMPLATES.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates" description="Create or browse templates to speed up your workflow." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t, i) => (
            <Card key={i} interactive padding="md" className="group">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${t.tone}-50 text-${t.tone}-600`}>
                  <LayoutTemplate className="h-5 w-5" />
                </span>
                {t.featured && <Star className="h-4 w-4 fill-warning-500 text-warning-500" />}
              </div>
              <h3 className="font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-[var(--fg-subtle)] line-clamp-2">{t.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <Badge tone="neutral">{t.category}</Badge>
                <span className="text-xs text-[var(--fg-subtle)]">{t.uses.toLocaleString()} uses</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
