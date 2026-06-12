import { motion } from 'framer-motion';
import { PenTool, Plus, Users, Layers, MousePointer2, Square, Circle as CircleIcon, Type, Eraser } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const BOARDS = [
  { id: 1, name: 'Architecture diagram', updated: '2h ago', members: 3 },
  { id: 2, name: 'User flow v2', updated: '1d ago', members: 5 },
  { id: 3, name: 'Brainstorming', updated: '3d ago', members: 2 },
];

const TOOLS = [
  { icon: MousePointer2, label: 'Select' },
  { icon: Square, label: 'Rectangle' },
  { icon: CircleIcon, label: 'Ellipse' },
  { icon: Type, label: 'Text' },
  { icon: PenTool, label: 'Pen' },
  { icon: Eraser, label: 'Eraser' },
];

export default function Whiteboards() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Whiteboards"
        description="Visual collaboration for ideas, flows and diagrams."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New whiteboard</Button>}
      />

      <Card padding="md">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">Tools</p>
          <div className="flex flex-wrap items-center gap-1">
            {TOOLS.map((t, i) => (
              <Button key={t.label} variant={i === 0 ? 'soft' : 'ghost'} size="icon-sm" aria-label={t.label}>
                <t.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {BOARDS.length === 0 ? (
        <EmptyState icon={PenTool} title="No whiteboards yet" description="Start sketching your ideas with a new board." action={<Button leftIcon={<Plus className="h-4 w-4" />}>Create whiteboard</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOARDS.map((b) => (
            <Card key={b.id} interactive padding="md">
              <div className="mb-3 aspect-video rounded-lg border border-[var(--border)] bg-gradient-to-br from-brand-50 via-accent-50 to-warning-50 dark:from-brand-950/30 dark:via-accent-950/30 dark:to-warning-950/30 grid-bg relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Layers className="h-10 w-10 text-brand-500/40" />
                </div>
              </div>
              <h3 className="font-semibold">{b.name}</h3>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--fg-subtle)]">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {b.members} collaborators</span>
                <span>{b.updated}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
