import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Users, Mail, Phone, Briefcase, MoreHorizontal } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Input, Badge, Skeleton, PageHeader, EmptyState } from '../components/ui';

export default function CRMContacts() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('organization_id');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_title: '', company_id: '' });

  const load = () => {
    api.get(`/crm/contacts?organization_id=${orgId}&search=${search}`)
      .then(r => setContacts(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    load();
    api.get(`/crm/companies?organization_id=${orgId}&limit=100`).then(r => setCompanies(r.data.data || []));
  }, [orgId, search]);

  const create = async () => {
    try {
      const r = await api.post(`/crm/contacts?organization_id=${orgId}`, form);
      navigate(`/app/crm/contacts/${r.data.data.id}`);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contacts`}
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Contact</Button>}
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {showCreate && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">New Contact</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="First name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            <Input placeholder="Last name *" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input placeholder="Job title" value={form.job_title} onChange={e => setForm({...form, job_title: e.target.value})} />
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.company_id} onChange={e => setForm({...form, company_id: e.target.value})}>
              <option value="">Select company...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={create} disabled={!form.last_name}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add your first contact to start building relationships"
          action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Contact</Button>}
        />
      ) : (
        <Card>
          <div className="divide-y dark:divide-gray-800">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/app/crm/contacts/${c.id}`)}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                  {(c.first_name?.[0] || c.last_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.full_name || `${c.first_name} ${c.last_name}`}</p>
                  <p className="text-sm text-gray-500 truncate">{c.job_title || 'No title'}{c.company_name ? ` at ${c.company_name}` : ''}</p>
                </div>
                <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                </div>
                <Badge variant="outline">{c.lifecycle_stage || 'subscriber'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
