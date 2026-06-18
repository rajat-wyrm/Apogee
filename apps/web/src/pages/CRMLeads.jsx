import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Mail, Phone, Building2, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Input, Badge, Skeleton, PageHeader, EmptyState } from '../components/ui';

export default function CRMLeads() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('organization_id');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company_name: '', source: 'website' });

  const load = () => {
    api.get(`/crm/leads?organization_id=${orgId}`)
      .then(r => setLeads(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  const create = async () => {
    try {
      await api.post(`/crm/leads?organization_id=${orgId}`, form);
      setShowCreate(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', company_name: '', source: 'website' });
      load();
    } catch (e) { alert(e.message); }
  };

  const convert = async (id) => {
    try {
      await api.post(`/crm/leads/${id}/convert?organization_id=${orgId}`);
      load();
    } catch (e) { alert(e.message); }
  };

  const statusColors = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-yellow-100 text-yellow-700', qualified: 'bg-green-100 text-green-700', unqualified: 'bg-red-100 text-red-700', converted: 'bg-purple-100 text-purple-700' };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} leads`}
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Lead</Button>}
      />

      {showCreate && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">New Lead</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="First name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            <Input placeholder="Last name" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input placeholder="Company name" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} />
            <select className="border rounded-md px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="social">Social Media</option>
              <option value="campaign">Campaign</option>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={create}>Create Lead</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No leads yet"
          description="Capture leads from your website, campaigns, and outreach"
          action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Add Lead</Button>}
        />
      ) : (
        <Card>
          <div className="divide-y dark:divide-gray-800">
            {leads.map(l => (
              <div key={l.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                  {(l.first_name?.[0] || l.last_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{l.first_name} {l.last_name}</p>
                  <p className="text-sm text-gray-500 truncate">{l.email} {l.company_name ? `• ${l.company_name}` : ''}</p>
                </div>
                <Badge className={statusColors[l.status] || ''}>{l.status}</Badge>
                <span className="text-sm text-gray-500 hidden md:inline">{l.source}</span>
                {l.status !== 'converted' && (
                  <Button size="sm" variant="outline" onClick={() => convert(l.id)}>
                    <TrendingUp className="w-3 h-3 mr-1" />Convert
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
