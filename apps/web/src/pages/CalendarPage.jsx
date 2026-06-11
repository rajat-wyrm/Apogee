import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import {
  addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addDays, subMonths
} from 'date-fns';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

const EVENT_TONES = {
  meeting: 'brand',
  deadline: 'danger',
  milestone: 'success',
  personal: 'accent',
};

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const events = [
    { id: 1, date: addDays(new Date(), 2), title: 'Product sync', type: 'meeting', time: '10:00 AM' },
    { id: 2, date: addDays(new Date(), 5), title: 'Launch deadline', type: 'deadline', time: 'All day' },
    { id: 3, date: addDays(new Date(), -1), title: 'Q4 milestone', type: 'milestone', time: '3:00 PM' },
  ];

  const dayEvents = events.filter((e) => isSameDay(e.date, selected));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Stay on top of deadlines, meetings and milestones."
        action={
          <>
            <Button variant="outline" onClick={() => setCurrent(new Date())}>Today</Button>
            <Button leftIcon={<CalendarIcon className="h-4 w-4" />}>New event</Button>
          </>
        }
      />

      <Card padding="md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{format(current, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrent(subMonths(current, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrent(addMonths(current, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, current);
            const isSelected = isSameDay(day, selected);
            const isDayToday = isToday(day);
            const hasEvents = events.some((e) => isSameDay(e.date, day));
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={cn(
                  'aspect-square rounded-lg p-1.5 text-left text-sm transition-all',
                  inMonth ? 'text-[var(--fg)]' : 'text-[var(--fg-subtle)]/40',
                  isSelected && 'bg-brand-600 text-white shadow-glow',
                  !isSelected && isDayToday && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 font-semibold',
                  !isSelected && !isDayToday && 'hover:bg-[var(--bg-muted)]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{format(day, 'd')}</span>
                  {hasEvents && !isSelected && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card padding="md">
        <h3 className="font-semibold mb-3">{format(selected, 'EEEE, MMMM d')}</h3>
        {dayEvents.length === 0 ? (
          <EmptyState icon={CalendarIcon} title="Nothing scheduled" description="Enjoy your day or plan something new." />
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--bg-muted)]/40 transition-colors">
                <span className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-xl',
                  e.type === 'meeting' && 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
                  e.type === 'deadline' && 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-300',
                  e.type === 'milestone' && 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300',
                  e.type === 'personal' && 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300',
                )}>
                  <Clock className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-[var(--fg-subtle)]">{e.time}</p>
                </div>
                <Badge tone={EVENT_TONES[e.type]} dot>{e.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
