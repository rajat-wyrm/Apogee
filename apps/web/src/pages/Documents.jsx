import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Trash2, Star, MoreVertical, Folder, Share2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';

export default function Documents() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();
  const { selectedWorkspaceId } = useOrgStore();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', selectedWorkspaceId],
    queryFn: () => api.get('/documents', { params: { workspaceId: selectedWorkspaceId } }).then((r) => r.data).catch(() => []),
    enabled: !!selectedWorkspaceId,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/documents', { ...payload, workspaceId: selectedWorkspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', selectedWorkspaceId]);
      setTitle('');
      setShowCreate(false);
      toast.success('Document created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', selectedWorkspaceId]);
      toast.success('Document deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const filtered = documents.filter((d) => !search || d.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Documents"
        description="Beautiful docs with real-time collaboration."
        action={<Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>New document</Button>}
      />

      <Card padding="md">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          leftIcon={<Search className="h-4 w-4" />}
          containerClassName="max-w-md"
        />
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No matching documents' : 'No documents yet'}
          description={search ? 'Try a different search term.' : 'Create your first document to get started.'}
          action={!search && <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>Create document</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id} interactive padding="md" className="group">
              <div className="flex items-start justify-between mb-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300">
                  <FileText className="h-5 w-5" />
                </span>
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  className="opacity-0 group-hover:opacity-100 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--fg-subtle)] hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10 transition-all"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <h3 className="font-semibold text-[var(--fg)] line-clamp-1">{d.title}</h3>
              <p className="mt-1 text-sm text-[var(--fg-subtle)] line-clamp-2">{d.content?.replace(/<[^>]+>/g, '').slice(0, 100) || 'No content yet.'}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--fg-subtle)]">
                <span>{d.updated_at ? formatDistanceToNow(new Date(d.updated_at), { addSuffix: true }) : 'just now'}</span>
                {d.is_starred && <Star className="h-3.5 w-3.5 fill-warning-500 text-warning-500" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create document"
        description="Start a new document for your team."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" loading={createMutation.isPending} disabled={!title.trim()} onClick={() => createMutation.mutate({ title: title.trim(), content: '' })}>
              Create
            </Button>
          </>
        }
      >
        <Input label="Title" placeholder="e.g. Team handbook" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Modal>
    </motion.div>
  );
}
