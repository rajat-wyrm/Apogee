import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Search, Trash2, Edit3, Filter, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Select } from '../components/ui/Select';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { Progress } from '../components/ui/Progress';
import { cn } from '../lib/utils';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

const STATUS_TONES = {
  active: 'brand',
  completed: 'success',
  archived: 'neutral',
  on_hold: 'warning',
};

export default function Projects() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [view, setView] = useState('grid');
  const queryClient = useQueryClient();
  const { selectedWorkspaceId } = useOrgStore();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', selectedWorkspaceId],
    queryFn: () => api.get('/projects', { params: { workspaceId: selectedWorkspaceId } }).then((r) => r.data),
    enabled: !!selectedWorkspaceId,
  });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !filterStatus || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [projects, searchTerm, filterStatus]);

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/projects', { ...payload, workspaceId: selectedWorkspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', selectedWorkspaceId]);
      setName('');
      setDescription('');
      setShowCreate(false);
      toast.success('Project created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => api.put(`/projects/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', selectedWorkspaceId]);
      setEditId(null);
      toast.success('Project updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', selectedWorkspaceId]);
      setDeleteId(null);
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/projects/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries(['projects', selectedWorkspaceId]),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  if (!selectedWorkspaceId) {
    return (
      <EmptyState
        icon={FolderKanban}
        tone="brand"
        title="No workspace selected"
        description="Create or select a workspace from the sidebar to manage projects."
      />
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Projects"
          description="Plan, organize and ship work across your team."
          action={
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
              New project
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={item}>
        <Card padding="md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex-1 max-w-md">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects…"
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="sm:w-44">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
                <option value="on_hold">On hold</option>
              </Select>
            </div>
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  view === 'grid' ? 'bg-[var(--bg-muted)] text-[var(--fg)]' : 'text-[var(--fg-subtle)]'
                )}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  view === 'list' ? 'bg-[var(--bg-muted)] text-[var(--fg)]' : 'text-[var(--fg-subtle)]'
                )}
                aria-label="List view"
                aria-pressed={view === 'list'}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        {isLoading ? (
          view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} padding="md">
                  <Skeleton className="h-5 w-2/3 mb-3" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-4/5 mb-4" />
                  <Skeleton className="h-2 w-full mb-3" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={searchTerm || filterStatus ? 'No matching projects' : 'No projects yet'}
            description={searchTerm || filterStatus ? 'Try adjusting your filters.' : 'Create your first project to start tracking work.'}
            action={!searchTerm && !filterStatus && <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Create project</Button>}
          />
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => {
              const progress = p.completion_rate ?? 0;
              const tone = STATUS_TONES[p.status] || 'neutral';
              return (
                <Card key={p.id} padding="md" interactive>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/app/projects/${p.id}`} className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">
                        <FolderKanban className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        {editId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-sm"
                            />
                            <Button size="xs" onClick={() => updateMutation.mutate({ id: p.id, updates: { name: editName } })}>Save</Button>
                          </div>
                        ) : (
                          <h3 className="font-semibold text-[var(--fg)] truncate">{p.name}</h3>
                        )}
                        <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">{p.task_count ?? 0} tasks · {p.member_count ?? 1} members</p>
                      </div>
                    </Link>
                  </div>
                  {p.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--fg-subtle)]">{p.description}</p>
                  )}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--fg-subtle)]">Progress</span>
                      <span className="font-medium text-[var(--fg-muted)]">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} tone={tone === 'neutral' ? 'brand' : tone} size="sm" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Select
                      value={p.status || 'active'}
                      onChange={(e) => statusMutation.mutate({ id: p.id, status: e.target.value })}
                      size="sm"
                      className="h-8 text-xs w-32"
                    >
                      <option value="active">Active</option>
                      <option value="on_hold">On hold</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditId(p.id); setEditName(p.name); }} aria-label="Edit project">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(p.id)} aria-label="Delete project" className="text-danger-600 hover:!bg-danger-50 dark:hover:!bg-danger-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((p) => (
                <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-muted)]/40 transition-colors">
                  <Link to={`/app/projects/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">
                      <FolderKanban className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--fg)] truncate">{p.name}</p>
                      <p className="text-xs text-[var(--fg-subtle)] truncate">{p.description || `${p.task_count ?? 0} tasks`}</p>
                    </div>
                  </Link>
                  <Badge tone={STATUS_TONES[p.status] || 'neutral'} dot>{p.status || 'active'}</Badge>
                  <span className="hidden sm:inline text-xs text-[var(--fg-subtle)]">{p.created_at ? format(new Date(p.created_at), 'MMM d') : ''}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditId(p.id); setEditName(p.name); }} aria-label="Edit project">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(p.id)} aria-label="Delete project" className="text-danger-600 hover:!bg-danger-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </motion.div>

      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create project"
        description="Give your project a name to get started."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              variant="gradient"
              loading={createMutation.isPending}
              disabled={!name.trim()}
              onClick={() => createMutation.mutate({ name: name.trim(), description: description.trim() })}
            >
              Create project
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Project name"
            placeholder="e.g. Q4 marketing site"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="Description"
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete project?"
        description="This action cannot be undone. All tasks and data inside this project will be permanently removed."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId)}>
              Delete project
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </motion.div>
  );
}
