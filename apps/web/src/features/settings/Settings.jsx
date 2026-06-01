import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore, useUIStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader } from '../../components/ui/Feedback';
import { User, Lock, Key, Trash2, Shield, Smartphone, Copy, Plus, X } from 'lucide-react';
import { cn, copy } from '../../lib/utils';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

export default function Settings() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="flex flex-col md:flex-row gap-4">
        <nav className="md:w-48 shrink-0 space-y-0.5">
          {[
            { to: '', label: 'Profile', icon: User, end: true },
            { to: 'security', label: 'Security', icon: Shield },
            { to: 'api-keys', label: 'API keys', icon: Key },
          ].map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}>
              <s.icon size={14} /> {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<ProfileSettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="api-keys" element={<ApiKeys />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { user, fetchMe } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '', timezone: user.timezone || 'UTC', locale: user.locale || 'en' });

  const update = useMutation({
    mutationFn: (data) => api.patch('/auth/me', data).then((r) => r.data),
    onSuccess: () => { fetchMe(); toast.success('Saved'); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="label">Full name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" /></div>
          <div><label className="label">Email</label><input value={user.email} disabled className="input bg-surface-2" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <div><label className="label">Timezone</label><input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="input" /></div>
          </div>
          <button onClick={() => update.mutate(form)} className="btn-primary">Save</button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map((t) => (
              <button key={t} onClick={() => setTheme(t)} className={cn('btn-secondary capitalize', theme === t && 'bg-brand-100 text-brand-700 dark:bg-brand-900/30')}>{t}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
        <CardContent>
          <button className="btn-danger"><Trash2 size={14} /> Delete account</button>
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySettings() {
  const [pwOpen, setPwOpen] = useState(false);
  const [enable2FA, setEnable2FA] = useState(false);
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');

  const handleEnable2FA = async () => {
    const { data } = await api.post('/auth/2fa/enable');
    setSecret(data.data.secret);
    setQr(data.data.qr);
    setEnable2FA(true);
  };

  const confirm2FA = async () => {
    await api.post('/auth/2fa/confirm', { code });
    toast.success('2FA enabled!');
    setEnable2FA(false);
  };

  const changePassword = async () => {
    const current = document.getElementById('cp_current')?.value;
    const next = document.getElementById('cp_next')?.value;
    if (!current || !next) return toast.error('Fill all fields');
    await api.post('/auth/change-password', { current_password: current, new_password: next });
    toast.success('Password changed');
    setPwOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardContent>
          <button onClick={() => setPwOpen(true)} className="btn-secondary"><Lock size={14} /> Change password</button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Two-factor authentication</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-fg-2 mb-3">Add an extra layer of security with TOTP-based 2FA.</p>
          <button onClick={handleEnable2FA} className="btn-primary"><Smartphone size={14} /> Enable 2FA</button>
        </CardContent>
      </Card>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" footer={<><button onClick={() => setPwOpen(false)} className="btn-secondary">Cancel</button><button onClick={changePassword} className="btn-primary">Update</button></>}>
        <div className="space-y-3">
          <div><label className="label">Current password</label><input id="cp_current" type="password" className="input" /></div>
          <div><label className="label">New password</label><input id="cp_next" type="password" className="input" /></div>
        </div>
      </Modal>

      <Modal open={enable2FA} onClose={() => setEnable2FA(false)} title="Enable 2FA" footer={<><button onClick={() => setEnable2FA(false)} className="btn-secondary">Cancel</button><button onClick={confirm2FA} className="btn-primary">Confirm</button></>}>
        <div className="space-y-3 text-center">
          {qr && <img src={qr} alt="QR" className="mx-auto rounded-lg border border-border" />}
          <p className="text-sm text-fg-2">Scan with Google Authenticator or 1Password</p>
          {secret && <div className="text-xs font-mono bg-surface-2 p-2 rounded">Secret: {secret}</div>}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="input text-center tracking-widest" maxLength={6} />
        </div>
      </Modal>
    </div>
  );
}

function ApiKeys() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState(null);

  const keys = useQuery({
    queryKey: ['api-keys', orgId],
    queryFn: () => api.get(`/admin/api-keys?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/admin/api-keys', { ...data, organization_id: orgId }).then((r) => r.data),
    onSuccess: (res) => { setNewKey(res.data); setCreateOpen(false); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>API keys</CardTitle>
        <button onClick={() => setCreateOpen(true)} className="btn-primary btn-sm"><Plus size={12} /> New key</button>
      </CardHeader>
      <CardContent>
        {keys.isLoading ? <Loader /> : (
          <div className="space-y-2">
            {keys.data?.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Key size={16} className="text-fg-3" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-fg-3 font-mono">{k.prefix}…</div>
                </div>
                <span className="text-xs text-fg-3">{k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
              </div>
            ))}
            {keys.data?.length === 0 && <p className="text-sm text-fg-3 text-center py-4">No API keys yet</p>}
          </div>
        )}
      </CardContent>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New API key" footer={<><button onClick={() => setCreateOpen(false)} className="btn-secondary">Done</button></>}>
        <div><label className="label">Name</label><input id="apikey-name" className="input" placeholder="Production server" /></div>
        <button onClick={() => create.mutate({ name: document.getElementById('apikey-name')?.value || 'New key' })} className="btn-primary mt-2">Generate</button>
      </Modal>
      {newKey && (
        <Modal open={true} onClose={() => setNewKey(null)} title="Save your API key" footer={<button onClick={() => setNewKey(null)} className="btn-primary">I've saved it</button>}>
          <div className="space-y-2">
            <p className="text-sm text-amber-600">⚠️ This is the only time you'll see this key.</p>
            <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg font-mono text-sm break-all">{newKey.key}</div>
            <button onClick={() => { copy(newKey.key); toast.success('Copied'); }} className="btn-secondary"><Copy size={14} /> Copy</button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
