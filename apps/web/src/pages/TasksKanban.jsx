import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, CheckSquare, ListTodo, Trash2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

const COLUMNS = [
  { key: 'todo', label: 'To Do', accent: 'border-slate-400', text: 'text-slate-600 dark:text-slate-300' },
  { key: 'in_progress', label: 'In Progress', accent: 'border-brand-500', text: 'text-brand-600 dark:text-brand-300' },
  { key: 'completed', label: 'Completed', accent: 'border-success-500', text: 'text-success-600 dark:text-success-300' },
];

const PRIORITY_TONES = { low: 'neutral', medium: 'warning', high: 'danger' };

export default function TasksKanban() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [addingTo, setAddingTo] = useState(null);
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

  const createMutation = useMutation({
    mutationFn: (payload) =>
      api.post('/tasks', { ...payload, workspaceId: selectedWorkspaceId, projectId: selectedProjectId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', selectedProjectId]);
      setNewTitle('');
      setAddingTo(null);
      toast.success('Task added');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries(['tasks', selectedProjectId]),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['tasks', selectedProjectId]),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key || (col.key === 'completed' && t.status === 'done'));
    return acc;
  }, {});

  if (!selectedWorkspaceId) {
    return (
      <EmptyState icon={ListTodo} tone="brand" title="No workspace selected" description="Select a workspace from the sidebar to view the Kanban board." />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Kanban Board"
        description="Drag-free flow — use the move buttons to update task status."
        action={
          <>
            <Button as={Link} to="/app/tasks" variant="outline" leftIcon={<ListTodo className="h-4 w-4" />}>
              List view
            </Button>
            <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-56">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96" />)}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = tasksByStatus[col.key] || [];
            return (
              <div key={col.key} className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 min-h-[400px]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', col.accent.replace('border-', 'bg-'))} />
                    <h3 className="text-sm font-semibold text-[var(--fg)]">{col.label}</h3>
                    <Badge tone="neutral" size="sm">{items.length}</Badge>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setAddingTo(col.key)} aria-label={`Add task to ${col.label}`}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto">
                  {items.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft hover:shadow-medium transition-all"
                    >
                      <p className="text-sm font-medium text-[var(--fg)]">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--fg-subtle)]">{task.description}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge tone={PRIORITY_TONES[task.priority] || 'neutral'} size="sm">{task.priority || 'medium'}</Badge>
                        <div className="flex flex-wrap items-center gap-1">
                          {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                            <button
                              key={c.key}
                              onClick={() => updateStatusMutation.mutate({ id: task.id, status: c.key })}
                              className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors"
                            >
                              <ArrowRight className="h-2.5 w-2.5" />
                              {c.label.split(' ')[0]}
                            </button>
                          ))}
                          <button
                            onClick={() => deleteMutation.mutate(task.id)}
                            className="inline-flex items-center justify-center rounded-md p-1 text-[var(--fg-subtle)] hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {addingTo === col.key && (
                    <form
                      onSubmit={(e) => { e.preventDefault(); if (newTitle.trim()) createMutation.mutate({ title: newTitle.trim(), status: col.key }); }}
                      className="rounded-xl border border-brand-300 bg-[var(--bg-elevated)] p-2 shadow-soft dark:border-brand-500/40"
                    >
                      <Input
                        autoFocus
                        placeholder="Task title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="!h-8 !text-sm"
                      />
                      <div className="mt-2 flex justify-end gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setAddingTo(null)}>Cancel</Button>
                        <Button size="xs" type="submit" loading={createMutation.isPending}>Add</Button>
                      </div>
                    </form>
                  )}
                  {items.length === 0 && addingTo !== col.key && (
                    <button
                      onClick={() => setAddingTo(col.key)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-8 text-xs text-[var(--fg-subtle)] hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600 transition-colors dark:hover:bg-brand-500/5 dark:hover:border-brand-500/30"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
