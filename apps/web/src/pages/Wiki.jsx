import { motion } from 'framer-motion';
import { BookOpen, Plus, Search, FileText, Clock, Hash, MoreVertical } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const SPACES = [
  { id: 1, name: 'Engineering', pages: 12, color: 'brand' },
  { id: 2, name: 'Product', pages: 8, color: 'accent' },
  { id: 3, name: 'People Ops', pages: 5, color: 'success' },
];

const PAGES = [
  { id: 1, space: 'Engineering', title: 'API Conventions', updated: '2h ago', emoji: '🚀' },
  { id: 2, space: 'Product', title: 'Roadmap Q4', updated: '5h ago', emoji: '🗺️' },
  { id: 3, space: 'Engineering', title: 'Frontend Handbook', updated: '1d ago', emoji: '📘' },
  { id: 4, space: 'People Ops', title: 'Onboarding Checklist', updated: '2d ago', emoji: '✅' },
];

export default function Wiki() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Wiki"
        description="A knowledge base for your entire team."
        action={<Button leftIcon={<Plus className="h-4 w-4" />}>New page</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {SPACES.map((s) => (
          <Card key={s.id} interactive padding="md">
            <div className="flex items-start justify-between">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${s.color}-50 text-${s.color}-600`}>
                <BookOpen className="h-5 w-5" />
              </span>
              <Badge tone="neutral">{s.pages} pages</Badge>
            </div>
            <h3 className="mt-3 font-semibold">{s.name}</h3>
            <p className="text-xs text-[var(--fg-subtle)] mt-0.5">Curated by your team</p>
          </Card>
        ))}
      </div>

      <Card padding="md">
        <div className="mb-4 max-w-md">
          <Input placeholder="Search the wiki…" leftIcon={<Search className="h-4 w-4" />} />
        </div>
        <div className="space-y-1">
          {PAGES.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--bg-muted)]/50 transition-colors">
              <span className="text-2xl">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{p.space} · updated {p.updated}</p>
              </div>
              <button className="text-[var(--fg-subtle)] hover:text-[var(--fg)]"><MoreVertical className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
