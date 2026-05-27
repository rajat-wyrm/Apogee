import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, Spinner, EmptyState } from '../../components/ui/Feedback';
import { Avatar, AvatarGroup } from '../../components/ui/Avatar';
import { Plus, MoreVertical, Calendar, Flag, Tag, MessageSquare, Paperclip, Clock, ListChecks, LayoutGrid, List as ListIcon, Calendar as CalendarIcon, BarChart3, Sparkles, X, Check, ChevronDown } from 'lucide-react';
import { cn, formatDate, formatRelative, isOverdue } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { joinRoom, leaveRoom } from '../../lib/socket';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-500', none: 'bg-slate-400' };
const PRIORITY_BG = { urgent: 'bg-red-50 dark:bg-red-900/20', high: 'bg-orange-50 dark:bg-orange-900/20', medium: 'bg-yellow-50 dark:bg-yellow-900/20', low: 'bg-blue-50 dark:bg-blue-900/20', none: 'bg-slate-50 dark:bg-slate-900/20' };

export default function ProjectDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('task');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [view, setView] = useState('kanban');
  const [createOpen, setCreateOpen] = useState(false);
  const [openTask, setOpenTask] = useState(taskId || null);
  const [filter, setFilter] = useState('all');

  const project = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const tasks = useQuery({
    queryKey: ['tasks', id, filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === 'mine') params.set('assignee_id', user.id);
      return api.get(`/projects/${id}/tasks?${params}`).then((r) => r.data.data);
    },
    enabled: !!id,
  });

  const createTask = useMutation({
    mutationFn: (data) => api.post('/tasks', { ...data, project_id: id }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['tasks', id]); setCreateOpen(false); toast.success('Task created'); },
  });

  const moveTask = useMutation({
    mutationFn: ({ id: tid, status_id, position }) => api.post(`/tasks/${tid}/move`, { status_id, position }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries(['tasks', id]),
  });

  if (project.isLoading) return <Loader />;
  if (!project.data) return <EmptyState title="Project not found" />;

  const statuses = project.data.statuses || [];
  const tasksByStatus = statuses.map((s) => ({ ...s, tasks: (tasks.data || []).filter((t) => t.status_id === s.id) }));

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 sm:p-6 border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ background: project.data.color || '#6366f1' }}>
              {project.data.icon || project.data.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{project.data.name}</h1>
              {project.data.description && <p className="text-sm text-fg-2 line-clamp-1">{project.data.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AvatarGroup users={project.data.members || []} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-auto text-sm">
              <option value="all">All tasks</option>
              <option value="mine">Assigned to me</option>
            </select>
            <div className="hidden sm:flex border border-border rounded-lg overflow-hidden">
              <button onClick={() => setView('kanban')} className={cn('p-2', view === 'kanban' && 'bg-surface-3')}><LayoutGrid size={14} /></button>
              <button onClick={() => setView('list')} className={cn('p-2', view === 'list' && 'bg-surface-3')}><ListIcon size={14} /></button>
              <button onClick={() => setView('calendar')} className={cn('p-2', view === 'calendar' && 'bg-surface-3')}><CalendarIcon size={14} /></button>
            </div>
            <button onClick={() => setCreateOpen(true)} className="btn-primary btn-sm"><Plus size={14} /> Task</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' && <KanbanView statuses={tasksByStatus} onOpen={setOpenTask} onMove={(tid, sid, pos) => moveTask.mutate({ id: tid, status_id: sid, position: pos })} onCreateInStatus={(s) => { setCreateOpen({ status: s }); }} />}
        {view === 'list' && <ListView tasks={tasks.data || []} onOpen={setOpenTask} />}
        {view === 'calendar' && <CalendarView tasks={tasks.data || []} onOpen={setOpenTask} />}
      </div>

      <TaskDetail taskId={openTask} onClose={() => { setOpenTask(null); navigate(`/app/projects/${id}`); }} projectId={id} />

      {createOpen && (
        <Modal
          open={true}
          onClose={() => setCreateOpen(false)}
          title="Create task"
          size="md"
          footer={
            <>
              <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
              <button form="create-task" type="submit" className="btn-primary">Create</button>
            </>
          }
        >
          <form id="create-task" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); createTask.mutate({ title: f.get('title'), description: f.get('description'), priority: f.get('priority'), status_id: (typeof createOpen === 'object' ? createOpen.status?.id : null) || statuses[0]?.id, due_date: f.get('due_date') || null }); }} className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input name="title" required className="input" placeholder="What needs to be done?" autoFocus />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" rows={3} className="input" placeholder="Add more detail…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Priority</label>
                <select name="priority" className="input" defaultValue="medium">
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="label">Due date</label>
                <input name="due_date" type="date" className="input" />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function KanbanView({ statuses, onOpen, onMove, onCreateInStatus }) {
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="h-full flex gap-3 p-4 sm:p-6 min-w-max">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="w-72 shrink-0 flex flex-col bg-surface-2 rounded-xl border border-border max-h-full"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const tid = e.dataTransfer.getData('taskId');
              if (tid) onMove(tid, status.id, Date.now());
            }}
          >
            <div className="flex items-center justify-between p-3 sticky top-0 bg-surface-2 rounded-t-xl z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: status.color }} />
                <span className="text-sm font-medium truncate">{status.name}</span>
                <span className="text-xs text-fg-3">{status.tasks.length}</span>
              </div>
              <button onClick={() => onCreateInStatus(status)} className="btn-icon btn-ghost"><Plus size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {status.tasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => onOpen(t.id)} />
              ))}
              {status.tasks.length === 0 && <div className="text-center text-xs text-fg-3 py-4">Drop or click + to add</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, onClick }) {
  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
      onClick={onClick}
      className="card p-3 cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition group"
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', PRIORITY_COLORS[task.priority])} />
        <h4 className="text-sm font-medium flex-1 group-hover:text-brand-600 transition line-clamp-2">{task.title}</h4>
      </div>
      {task.description && <p className="text-xs text-fg-2 line-clamp-2 ml-3.5">{task.description}</p>}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-fg-3">
          {task.due_date && <span className={cn('flex items-center gap-1', isOverdue(task.due_date) && 'text-red-600')}><Calendar size={11} /> {formatDate(task.due_date, { month: 'short', day: 'numeric' })}</span>}
        </div>
        {task.assignee_id ? (
          <Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-dashed border-fg-3" />
        )}
      </div>
    </motion.div>
  );
}

function ListView({ tasks, onOpen }) {
  if (tasks.length === 0) return <EmptyState icon={ListChecks} title="No tasks" description="Create your first task to get started" />;
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-fg-3">
            <tr>
              <th className="text-left p-3 w-8"></th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Assignee</th>
              <th className="text-left p-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-surface-2 cursor-pointer" onClick={() => onOpen(t.id)}>
                <td className="p-3"><span className={cn('h-2 w-2 rounded-full inline-block', PRIORITY_COLORS[t.priority])} /></td>
                <td className="p-3 font-medium">{t.title}</td>
                <td className="p-3 capitalize">{t.priority}</td>
                <td className="p-3"><span className="badge badge-gray" style={{ background: t.status_color + '20', color: t.status_color }}>{t.status_name}</span></td>
                <td className="p-3">{t.assignee_name || '—'}</td>
                <td className={cn('p-3', isOverdue(t.due_date) && 'text-red-600')}>{t.due_date ? formatDate(t.due_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CalendarView({ tasks, onOpen }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-1">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(month - 1); }} className="btn-icon btn-ghost">‹</button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} className="btn-secondary btn-sm">Today</button>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(month + 1); }} className="btn-icon btn-ghost">›</button>
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-7 text-xs text-fg-3 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="p-2 text-center font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const dayTasks = d ? tasks.filter((t) => { if (!t.due_date) return false; const dt = new Date(t.due_date); return dt.getDate() === d && dt.getMonth() === month && dt.getFullYear() === year; }) : [];
            return (
              <div key={i} className={cn('border-b border-r border-border p-1.5 min-h-[90px]', !d && 'bg-surface-2')}>
                {d && <div className={cn('text-xs', d === today.getDate() && month === today.getMonth() && year === today.getFullYear() && 'text-brand-600 font-semibold')}>{d}</div>}
                <div className="space-y-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button key={t.id} onClick={() => onOpen(t.id)} className={cn('w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate', PRIORITY_BG[t.priority])}>{t.title}</button>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[10px] text-fg-3">+{dayTasks.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function TaskDetail({ taskId, onClose, projectId }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [comment, setComment] = useState('');

  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get(`/tasks/${taskId}`).then((r) => r.data.data),
    enabled: !!taskId,
  });

  const comments = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/comments`).then((r) => r.data.data),
    enabled: !!taskId,
  });

  const update = useMutation({
    mutationFn: (data) => api.patch(`/tasks/${taskId}`, data).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['task', taskId]); qc.invalidateQueries(['tasks', projectId]); },
  });

  const addComment = useMutation({
    mutationFn: (data) => api.post(`/tasks/${taskId}/comments`, data).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['task-comments', taskId]); setComment(''); },
  });

  useEffect(() => {
    if (taskId) joinRoom(`project:${projectId}`);
    return () => leaveRoom(`project:${projectId}`);
  }, [taskId, projectId]);

  if (!taskId) return null;
  if (task.isLoading) return <div className="fixed inset-0 z-40 flex"><div className="ml-auto w-full max-w-xl bg-surface shadow-2xl p-6"><Spinner /></div></div>;

  const t = task.data;
  if (!t) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-surface shadow-2xl flex flex-col border-l border-border"
      >
        <div className="p-5 border-b border-border flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-fg-3 mb-1">
              <span>{t.project_name}</span> · <span>#{t.number}</span>
            </div>
            <input
              value={t.title}
              onChange={(e) => update.mutate({ title: e.target.value })}
              className="text-lg font-semibold w-full bg-transparent focus:outline-none"
            />
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={t.status_id || ''} onChange={(e) => update.mutate({ status_id: e.target.value })} className="input">
                <option value="">None</option>
                {task.data?.statuses?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) || null}
              </select>
            </Field>
            <Field label="Priority">
              <select value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value })} className="input">
                {['urgent', 'high', 'medium', 'low', 'none'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <div className="input flex items-center gap-2">
                {t.assignee_id ? <Avatar name={t.assignee_name} src={t.assignee_avatar} size="xs" /> : <div className="h-5 w-5 rounded-full border-2 border-dashed border-fg-3" />}
                <span>{t.assignee_name || 'Unassigned'}</span>
              </div>
            </Field>
            <Field label="Due date">
              <input type="date" value={t.due_date?.split('T')[0] || ''} onChange={(e) => update.mutate({ due_date: e.target.value || null })} className="input" />
            </Field>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={t.description || ''}
              onChange={(e) => update.mutate({ description: e.target.value })}
              rows={4}
              className="input"
              placeholder="Add a description…"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MessageSquare size={14} /> Comments</h3>
            <div className="space-y-3">
              {comments.data?.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.author_name} src={c.author_avatar} size="sm" />
                  <div className="flex-1">
                    <div className="text-xs text-fg-3"><span className="font-medium text-fg">{c.author_name || 'You'}</span> · {formatRelative(c.created_at)}</div>
                    <p className="text-sm mt-0.5">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addComment.mutate({ body: comment }); }} className="mt-3 flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="input" />
              <button type="submit" disabled={!comment.trim()} className="btn-primary btn-sm">Send</button>
            </form>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
