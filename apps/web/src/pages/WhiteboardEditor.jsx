import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MousePointer2, Square, Circle as CircleIcon, Type, PenTool, Eraser, Save, Share2, PenTool as PenIcon } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

const TOOLS = [
  { icon: MousePointer2, label: 'Select', key: 'select' },
  { icon: Square, label: 'Rectangle', key: 'rect' },
  { icon: CircleIcon, label: 'Ellipse', key: 'circle' },
  { icon: Type, label: 'Text', key: 'text' },
  { icon: PenTool, label: 'Pen', key: 'pen' },
  { icon: Eraser, label: 'Eraser', key: 'eraser' },
];

export default function WhiteboardEditor() {
  const { id } = useParams();

  if (!id) {
    return <EmptyState icon={PenIcon} title="Whiteboard not found" />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100dvh-3.5rem)] flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2">
        <Button as={Link} to="/app/whiteboards" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Button>
        <span className="text-sm font-medium">Untitled whiteboard</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" leftIcon={<Share2 className="h-4 w-4" />}>Share</Button>
        <Button size="sm" leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden sm:flex flex-col gap-1 border-r border-[var(--border)] bg-[var(--bg-elevated)] p-2">
          {TOOLS.map((t, i) => (
            <button
              key={t.key}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors',
                i === 0 && 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              )}
              title={t.label}
              aria-label={t.label}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        </aside>

        <div className="flex-1 grid-bg overflow-auto bg-[var(--bg-muted)]/30 relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-[var(--fg-subtle)]">Whiteboard canvas — start drawing</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
