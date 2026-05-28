import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Avatar } from '../../components/ui/Avatar';
import { Plus, Users, Mail } from 'lucide-react';
import { formatRelative, cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Team() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'member' });

  const members = useQuery({
    queryKey: ['members', currentOrganization?.id],
    queryFn: () => api.get(`/organizations/${currentOrganization.id}/members`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const teams = useQuery({
    queryKey: ['teams', currentOrganization?.id],
    queryFn: () => api.get(`/teams?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const presence = useQuery({
    queryKey: ['presence', currentOrganization?.id],
    queryFn: () => api.get(`/teams/additional/presence?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
    refetchInterval: 30000,
  });

  const inviteM = useMutation({
    mutationFn: (data) => api.post(`/organizations/${currentOrganization.id}/members`, { ...data, orgName: currentOrganization.name }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries(['members']); setInviteOpen(false); setInvite({ email: '', role: 'member' }); toast.success('Invited'); },
  });

  const createTeam = useMutation({
    mutationFn: (data) => api.post('/teams', { ...data, organization_id: currentOrganization.id }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries(['teams']); setTeamOpen(false); toast.success('Team created'); },
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-fg-2 mt-0.5">Members, teams, and presence</p>
        </div>
        <div className="flex gap-2">
          {tab === 'members' && <button onClick={() => setInviteOpen(true)} className="btn-primary"><Mail size={14} /> Invite</button>}
          {tab === 'teams' && <button onClick={() => setTeamOpen(true)} className="btn-primary"><Plus size={14} /> New team</button>}
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {['members', 'teams', 'presence'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-3 py-2 text-sm capitalize border-b-2 -mb-px', tab === t ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-fg-2')}>{t}</button>
        ))}
      </div>

      {tab === 'members' && (
        members.isLoading ? <Loader /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {members.data?.map((m) => {
              const p = presence.data?.find((x) => x.id === m.id);
              return (
                <Card key={m.id} className="hover:shadow-md transition">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar name={m.full_name} src={m.avatar_url} status={p?.status} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.full_name}</div>
                      <div className="text-xs text-fg-3 truncate">{m.email}</div>
                    </div>
                    <span className={cn('badge capitalize', m.role === 'owner' ? 'badge-brand' : 'badge-gray')}>{m.role}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'teams' && (
        teams.isLoading ? <Loader /> : teams.data?.length === 0 ? (
          <EmptyState icon={Users} title="No teams" description="Create teams to organize members" action={<button onClick={() => setTeamOpen(true)} className="btn-primary"><Plus size={14} /> New team</button>} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.data?.map((t) => (
              <Card key={t.id} className="hover:shadow-md transition">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg text-white flex items-center justify-center" style={{ background: t.color || '#6366f1' }}>{t.icon || t.name[0]}</div>
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-fg-3">{t.member_count} members</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'presence' && (
        presence.isLoading ? <Loader /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {presence.data?.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar name={m.full_name} src={m.avatar_url} status={m.status} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.full_name}</div>
                    <div className="text-xs text-fg-3 capitalize">{m.status || 'offline'}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite member" size="sm" footer={<><button onClick={() => setInviteOpen(false)} className="btn-secondary">Cancel</button><button onClick={() => inviteM.mutate(invite)} className="btn-primary">Invite</button></>}>
        <div className="space-y-3">
          <div><label className="label">Email</label><input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className="input" placeholder="teammate@company.com" /></div>
          <div><label className="label">Role</label><select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="input"><option value="admin">Admin</option><option value="member">Member</option><option value="guest">Guest</option></select></div>
        </div>
      </Modal>

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="New team" size="sm" footer={<><button onClick={() => setTeamOpen(false)} className="btn-secondary">Cancel</button><button onClick={() => { const el = document.getElementById('team-form'); el?.requestSubmit(); }} className="btn-primary">Create</button></>}>
        <form id="team-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); createTeam.mutate({ name: f.get('name'), color: f.get('color'), description: f.get('description') }); }} className="space-y-3">
          <div><label className="label">Name</label><input name="name" required className="input" placeholder="Engineering" /></div>
          <div><label className="label">Description</label><textarea name="description" rows={2} className="input" /></div>
          <div><label className="label">Color</label><input name="color" type="color" defaultValue="#6366f1" className="input h-10 p-1" /></div>
        </form>
      </Modal>
    </div>
  );
}
