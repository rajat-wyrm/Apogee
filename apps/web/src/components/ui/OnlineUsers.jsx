import { useQuery } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { Tooltip } from './Overlay';
import api from '../../lib/api';
import { useAuthStore, usePresenceStore } from '../../store';
import { useState } from 'react';

export function OnlineUsers() {
  const { currentOrganization } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['presence', currentOrganization?.id],
    queryFn: () => api.get(`/teams/additional/presence?organization_id=${currentOrganization.id}`).then((r) => r.data.data || []),
    enabled: !!currentOrganization,
    refetchInterval: 30000,
  });
  const online = (data || []).filter((u) => ['online', 'away'].includes(u.status)).slice(0, 4);

  if (isLoading || !currentOrganization) return null;
  if (online.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
      {online.slice(0, 3).map((u) => (
        <Tooltip key={u.id} content={`${u.full_name} (${u.status})`}>
          <div className="relative">
            <Avatar name={u.full_name} src={u.avatar_url} size="xs" status={u.status === 'online' ? 'online' : 'away'} className="ring-2 ring-surface" />
          </div>
        </Tooltip>
      ))}
      {online.length > 3 && (
        <div className="h-6 w-6 rounded-full bg-surface-3 text-[10px] flex items-center justify-center font-semibold ring-2 ring-surface text-fg-2">+{online.length - 3}</div>
      )}
    </div>
  );
}
