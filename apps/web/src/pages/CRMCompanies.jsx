import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Filter, Building2, Phone, Mail, Globe, MapPin, MoreHorizontal, Star } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Input, Badge, Skeleton, PageHeader, EmptyState } from '../components/ui';

export default function CRMCompanies() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('organization_id');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', industry: '', phone: '', email: '' });

  const load = () => {
    api.get(`/crm/companies?organization_id=${orgId}&search=${search}`)
      .then(r => setCompanies(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (orgId) load(); }, [orgId, search]);

  const create = async () => {
    try {
      const r = await api.post(`/crm/companies?organization_id=${orgId}`, form);
      navigate(`/app/crm/companies/${r.data.data.id}`);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} companies`}
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Company</Button>}
      />

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {showCreate && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">New Company</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Company name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Input placeholder="Domain" value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} />
            <Input placeholder="Industry" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={create} disabled={!form.name}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add your first company to start tracking deals and contacts"
          action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Company</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(c => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/app/crm/companies/${c.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{c.name}</h4>
                    {c.industry && <p className="text-xs text-gray-500">{c.industry}</p>}
                  </div>
                </div>
                {c.rating > 0 && <div className="flex">{Array.from({length: c.rating}).map((_,i) => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}</div>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                {c.domain && <div className="flex items-center gap-2"><Globe className="w-3 h-3" />{c.domain}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{c.email}</div>}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <Badge variant="outline">{c.contact_count || 0} contacts</Badge>
                <Badge variant="outline">{c.deal_count || 0} deals</Badge>
                <span className="font-semibold text-green-600">${(c.open_value || 0).toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
