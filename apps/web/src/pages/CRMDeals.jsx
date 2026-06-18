import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, DollarSign, Calendar, TrendingUp, MoreHorizontal } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Input, Badge, Skeleton, PageHeader, EmptyState } from '../components/ui';

export default function CRMDeals() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('organization_id');
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ title: '', pipeline_id: '', stage_id: '', value: 0, contact_id: '', company_id: '', expected_close_date: '' });

  const load = () => {
    Promise.all([
      api.get(`/crm/deals?organization_id=${orgId}`),
      api.get(`/crm/pipelines?organization_id=${orgId}`),
    ]).then(([dealsRes, pipesRes]) => {
      setDeals(dealsRes.data.data || []);
      setPipelines(pipesRes.data.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!orgId) return;
    load();
    api.get(`/crm/contacts?organization_id=${orgId}&limit=100`).then(r => setContacts(r.data.data || []));
    api.get(`/crm/companies?organization_id=${orgId}&limit=100`).then(r => setCompanies(r.data.data || []));
  }, [orgId]);

  const create = async () => {
    try {
      const r = await api.post(`/crm/deals?organization_id=${orgId}`, { ...form, value: parseFloat(form.value) || 0 });
      navigate(`/app/crm/deals/${r.data.data.id}`);
    } catch (e) { alert(e.message); }
  };

  const selectedPipeline = pipelines.find(p => p.id === form.pipeline_id);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Deals"
        subtitle={`${deals.length} deals • $${deals.reduce((s, d) => s + (d.value || 0), 0).toLocaleString()} total`}
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />New Deal</Button>}
      />

      {showCreate && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">New Deal</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Deal title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="col-span-2" />
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.pipeline_id} onChange={e => setForm({...form, pipeline_id: e.target.value, stage_id: ''})}>
              <option value="">Select pipeline...</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.stage_id} onChange={e => setForm({...form, stage_id: e.target.value})} disabled={!form.pipeline_id}>
              <option value="">Select stage...</option>
              {selectedPipeline?.stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input type="number" placeholder="Value" value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
            <Input type="date" placeholder="Expected close" value={form.expected_close_date} onChange={e => setForm({...form, expected_close_date: e.target.value})} />
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.contact_id} onChange={e => setForm({...form, contact_id: e.target.value})}>
              <option value="">Select contact...</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.company_id} onChange={e => setForm({...form, company_id: e.target.value})}>
              <option value="">Select company...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={create} disabled={!form.title || !form.pipeline_id || !form.stage_id}>Create Deal</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No deals yet"
          description="Create your first deal to start tracking your sales pipeline"
          action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />New Deal</Button>}
        />
      ) : (
        <Card>
          <div className="divide-y dark:divide-gray-800">
            {deals.map(d => (
              <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/app/crm/deals/${d.id}`)}>
                <div className="w-3 h-10 rounded-full" style={{ backgroundColor: d.stage_color || '#6366f1' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-gray-500">{d.contact_name || 'No contact'} {d.company_name ? `• ${d.company_name}` : ''}</p>
                </div>
                <Badge variant="outline">{d.stage_name || 'No stage'}</Badge>
                <span className="text-sm text-gray-500 hidden md:inline">{d.expected_close_date || 'No date'}</span>
                <span className="font-semibold text-green-600 w-28 text-right">${(d.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
