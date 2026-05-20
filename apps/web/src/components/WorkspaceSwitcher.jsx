import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import useOrgStore from '../store/orgStore';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WorkspaceSwitcher() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { selectedOrgId, selectedWorkspaceId, setSelectedWorkspace } = useOrgStore();

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces', selectedOrgId],
    queryFn: () =>
      api.get('/workspaces', { headers: { 'X-Organization-Id': selectedOrgId } }).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspace]);

  const createMutation = useMutation({
    mutationFn: (name) =>
      api.post(
        '/workspaces',
        { name, slug: name.toLowerCase().replace(/\s+/g, '-') },
        { headers: { 'X-Organization-Id': selectedOrgId } }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['workspaces', selectedOrgId]);
      setSelectedWorkspace(data.data.id);
      setName('');
      setShowCreate(false);
      toast.success('Workspace created!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create workspace');
    },
  });

  if (!selectedOrgId) return null;

  if (isLoading) {
    return <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-gray-400" /></div>;
  }

  if (workspaces.length === 0 && !showCreate) {
    return (
      <button
        onClick={() => setShowCreate(true)}
        className="w-full rounded-lg bg-blue-600/80 px-3 py-2 text-sm text-white hover:bg-blue-700 transition flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Create Workspace
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {workspaces.length > 0 && (
        <select
          value={selectedWorkspaceId || ''}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id} className="text-black">{ws.name}</option>
          ))}
        </select>
      )}
      {showCreate ? (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(name.trim()); }} className="flex gap-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button type="submit" disabled={createMutation.isPending} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 transition disabled:opacity-50">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
          </button>
        </form>
      ) : (
        <button onClick={() => setShowCreate(true)} className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition">
          + New Workspace
        </button>
      )}
    </div>
  );
}
