import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderKanban, Calendar, Users, CheckSquare, Circle, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

const STATUS_TONES = { active: 'brand', completed: 'success', archived: 'neutral', on_hold: 'warning' };
const TASK_TONES = { todo: 'neutral', in_progress: 'brand', done: 'success', completed: 'success', blocked: 'danger' };
const PRIORITY_TONES = { low: 'neutral', medium: 'warning', high: 'danger' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { selectedOrgId } = useOrgStore();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => api.get('/tasks', { params: { projectId: id } }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', id],
    queryFn: () => api.get(`/projects/${id}/members`).then((r) => r.data).catch(() => []),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="The project you're looking for doesn't exist or has been deleted."
        action={<Button as={Link} to="/app/projects" leftIcon={<ArrowLeft className="h-4 w-4" />}>Back to projects</Button>}
      />
    );
  }

  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo' || t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    completed: tasks.filter((t) => t.status === 'completed' || t.status === 'done'),
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Button as={Link} to="/app/projects" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
        Back to projects
      </Button>

      <PageHeader
        eyebrow={<Badge tone={STATUS_TONES[project.status] || 'neutral'} dot>{project.status || 'active'}</Badge>}
        title={project.name}
        description={project.description || 'No description provided.'}
        action={
          <>
            <Button variant="outline">Share</Button>
            <Button variant="gradient" leftIcon={<CheckSquare className="h-4 w-4" />}>Add task</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Progress</p>
          <p className="mt-2 text-3xl font-bold">{progress}%</p>
          <Progress value={progress} tone={progress === 100 ? 'success' : 'brand'} className="mt-3" />
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Tasks</p>
          <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">{completed} completed</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Team</p>
          <div className="mt-2">
            {members.length > 0 ? (
              <AvatarGroup size="sm">
                {members.map((m) => <Avatar key={m.id} name={m.full_name || m.name} />)}
              </AvatarGroup>
            ) : (
              <span className="text-sm text-[var(--fg-subtle)]">No members</span>
            )}
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">Due date</p>
          <p className="mt-2 text-base font-semibold">
            {project.due_date ? format(new Date(project.due_date), 'MMM d, yyyy') : '—'}
          </p>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            {project.due_date ? `Created ${format(new Date(project.created_at || Date.now()), 'MMM d')}` : ''}
          </p>
        </Card>
      </div>

      <Card padding="md">
        <Tabs defaultValue="board">
          <TabsList variant="pills">
            <TabsTrigger value="board" variant="pills">Board</TabsTrigger>
            <TabsTrigger value="list" variant="pills">List</TabsTrigger>
            <TabsTrigger value="overview" variant="pills">Overview</TabsTrigger>
          </TabsList>
          <TabsContent value="board">
            <div className="grid gap-4 lg:grid-cols-3">
              {Object.entries({
                'To do': tasksByStatus.todo,
                'In progress': tasksByStatus.in_progress,
                'Completed': tasksByStatus.completed,
              }).map(([label, items]) => (
                <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-[var(--fg)]">{label}</h3>
                    <Badge tone="neutral" size="sm">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-xs text-[var(--fg-subtle)]">No tasks here.</p>
                    ) : (
                      items.map((t) => (
                        <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft hover:shadow-medium transition-shadow">
                          <p className="text-sm font-medium text-[var(--fg)]">{t.title}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <Badge tone={PRIORITY_TONES[t.priority] || 'neutral'} size="sm">{t.priority || 'medium'}</Badge>
                            {t.due_date && <span className="text-[10px] text-[var(--fg-subtle)]">{format(new Date(t.due_date), 'MMM d')}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="list">
            {tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No tasks yet" description="Create the first task for this project." />
            ) : (
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-3 hover:bg-[var(--bg-muted)]/40 transition-colors">
                    {t.status === 'completed' || t.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-success-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-[var(--fg-subtle)] shrink-0" />
                    )}
                    <span className={cn('flex-1 text-sm', (t.status === 'completed' || t.status === 'done') && 'line-through text-[var(--fg-subtle)]')}>{t.title}</span>
                    <Badge tone={PRIORITY_TONES[t.priority] || 'neutral'} size="sm">{t.priority || 'medium'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="md" variant="flat">
                <CardTitle>Project details</CardTitle>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-subtle)]">Status</dt>
                    <dd><Badge tone={STATUS_TONES[project.status] || 'neutral'} dot>{project.status || 'active'}</Badge></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-subtle)]">Created</dt>
                    <dd className="text-[var(--fg)]">{project.created_at ? format(new Date(project.created_at), 'PP') : '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-subtle)]">Owner</dt>
                    <dd className="text-[var(--fg)]">{project.owner_name || 'Unknown'}</dd>
                  </div>
                </dl>
              </Card>
              <Card padding="md" variant="flat">
                <CardTitle>Team</CardTitle>
                <div className="mt-4 space-y-2">
                  {members.length === 0 ? (
                    <p className="text-sm text-[var(--fg-subtle)]">No team members yet.</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <Avatar name={m.full_name || m.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{m.full_name || m.name}</p>
                          <p className="text-xs text-[var(--fg-subtle)] truncate">{m.email}</p>
                        </div>
                        <Badge tone="neutral" size="sm">{m.role || 'member'}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}
