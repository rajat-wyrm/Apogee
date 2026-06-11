import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Search, Trash2, Edit3, Calendar, KanbanSquare, Filter } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { Textarea } from '../components/ui/Textarea';
import { cn } from '../lib/utils';

const STATUS_TONES = { todo: 'neutral', in_progress: 'brand', completed: 'success', done: 'success', blocked: 'danger' };
const PRIORITY_TONES = { low: 'neutral', medium: 'warning', high: 'danger' };

export default function Tasks() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { selectedWorkspaceId } = useOrgStore();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', selectedWorkspaceId],
    queryFn: () => api.get('/projects', { params: { workspaceId: selectedWorkspaceId } }).then((r) => r.data),
    enabled: !!selectedWorkspaceId,
    onSuccess: (data) => { if (data.length > 0 && !selectedProjectId) setSelectedProjectId(data[0].id); },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => api.get('/tasks', { params: { projectId: selectedProjectId } }).then((r) => r.data),
    enabled: !!selectedProjectId,
  });

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchPriority = !filterPriority || t.priority === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tasks, searchTerm, filterStatus, filterPriority]);

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/tasks', { ...payload, workspaceId: selectedWorkspaceId, projectId: selectedProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', selectedProjectId]);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setShowCreate(false);
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => api.put(`/tasks/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', selectedProjectId]);
      setEditId(null);
      toast.success('Task updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', selectedProjectId]);
      setDeleteId(null);
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  if (!selectedWorkspaceId) {
    return (
      <EmptyState
        icon={CheckSquare}
        tone="brand"
        title="No workspace selected"
        description="Select a workspace from the sidebar to manage tasks."
      />
    );
  }

  if (!selectedProjectId && projects.length === 0) {
    return (
      <EmptyState
        icon={FolderIcon()}
        title="No projects yet"
        description="Create a project first, then add tasks to it."
        action={<Button as={Link} to="/app/projects" leftIcon={<Plus className="h-4 w-4" />}>Create project</Button>}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Track work, set priorities and stay on schedule."
        action={
          <>
            <Button as={Link} to="/app/tasks/kanban" variant="outline" leftIcon={<KanbanSquare className="h-4 w-4" />}>
              Kanban board
            </Button>
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />} disabled={!selectedProjectId}>
              New task
            </Button>
          </>
        }
      />

      <Card padding="md">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks…"
            leftIcon={<Search className="h-4 w-4" />}
            containerClassName="md:w-64"
          />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="md:w-40">
            <option value="">All status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </Select>
          <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="md:w-36">
            <option value="">All priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={searchTerm || filterStatus || filterPriority ? 'No matching tasks' : 'No tasks yet'}
          description={searchTerm || filterStatus || filterPriority ? 'Try adjusting your filters.' : 'Create the first task to start tracking work.'}
          action={!searchTerm && !filterStatus && !filterPriority && <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Create task</Button>}
        />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((t) => {
              const isDone = t.status === 'completed' || t.status === 'done';
              return (
                <li key={t.id} className="group flex flex-col gap-3 p-4 hover:bg-[var(--bg-muted)]/40 transition-colors sm:flex-row sm:items-center">
                  <button
                    onClick={() => updateMutation.mutate({ id: t.id, updates: { status: isDone ? 'todo' : 'completed' } })}
                    className={cn(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isDone ? 'border-success-500 bg-success-500 text-white' : 'border-[var(--border-strong)] hover:border-brand-500'
                    )}
                    aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                  >
                    {isDone && <CheckSquare className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editId === t.id ? (
                      <Input
                        autoFocus
                        value={t.title}
                        onChange={(e) => updateMutation.mutate({ id: t.id, updates: { title: e.target.value } })}
                        onBlur={() => setEditId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditId(null)}
                      />
                    ) : (
                      <p className={cn('text-sm font-medium', isDone ? 'text-[var(--fg-subtle)] line-through' : 'text-[var(--fg)]')}>
                        {t.title}
                      </p>
                    )}
                    {t.description && (
                      <p className="mt-1 text-xs text-[var(--fg-subtle)] line-clamp-1">{t.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={PRIORITY_TONES[t.priority] || 'neutral'} size="sm">{t.priority || 'medium'}</Badge>
                    <Select
                      value={t.status}
                      onChange={(e) => updateMutation.mutate({ id: t.id, updates: { status: e.target.value } })}
                      size="sm"
                      className="h-8 text-xs w-32"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </Select>
                    {t.due_date && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
                        <Calendar className="h-3 w-3" /> {format(new Date(t.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditId(t.id)} aria-label="Edit task">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(t.id)} aria-label="Delete task" className="text-danger-600 hover:!bg-danger-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create task"
        description="Add a task to keep your team in sync."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              variant="gradient"
              loading={createMutation.isPending}
              disabled={!title.trim()}
              onClick={() => createMutation.mutate({ title: title.trim(), description: description.trim(), priority, due_date: dueDate || null })}
            >
              Create task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Implement search"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <Textarea
            label="Description"
            placeholder="Add details (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--fg)]">Priority</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete task?"
        description="This action cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId)}>
              Delete task
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </motion.div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
