import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users, Building2, TrendingUp, Target, Phone, Mail,
  Calendar, DollarSign, Briefcase, ChevronRight, Activity
} from 'lucide-react';
import api from '../lib/api';
import { Card, Badge, Button, Skeleton, PageHeader } from '../components/ui';

export default function CRMDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const orgId = localStorage.getItem('organization_id');

  useEffect(() => {
    if (!orgId) return;
    api.get(`/crm/dashboard?organization_id=${orgId}`)
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = [
    { label: 'Pipeline Value', value: `$${(data?.pipeline_value || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Won This Period', value: `$${(data?.won_value || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Deals Won', value: data?.won_count || 0, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Active Pipelines', value: data?.deals_by_stage?.length || 0, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="CRM Dashboard"
        subtitle="Track your sales pipeline, contacts, and deals"
        action={<Button onClick={() => navigate('/app/crm/deals/new')}><Target className="w-4 h-4 mr-2" />New Deal</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-6 h-6 ${s.color}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5" />Pipeline Stages</h3>
          <div className="space-y-3">
            {data?.deals_by_stage?.map(stage => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium w-28">{stage.stage}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (stage.value / Math.max(1, data.pipeline_value)) * 100)}%`, backgroundColor: stage.color }} />
                </div>
                <span className="text-sm text-gray-500 w-20 text-right">{stage.count} deals</span>
                <span className="text-sm font-medium w-24 text-right">${(stage.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5" />Top Deals</h3>
          <div className="space-y-3">
            {data?.top_deals?.slice(0, 5).map(deal => (
              <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => navigate(`/app/crm/deals/${deal.id}`)}>
                <div>
                  <p className="font-medium text-sm">{deal.title}</p>
                  <p className="text-xs text-gray-500">{deal.contact_name || deal.company_name || 'No contact'}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">${(deal.value || 0).toLocaleString()}</span>
              </div>
            ))}
            {(!data?.top_deals || data.top_deals.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No deals yet. Create your first deal!</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5" />Recent Activities</h3>
        <div className="space-y-2">
          {data?.recent_activities?.slice(0, 10).map(act => (
            <div key={act.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {act.type === 'call' ? <Phone className="w-4 h-4" /> : act.type === 'email' ? <Mail className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{act.subject}</p>
                <p className="text-xs text-gray-500">{act.contact_name || 'No contact'} • {new Date(act.created_at).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline">{act.type}</Badge>
            </div>
          ))}
          {(!data?.recent_activities || data.recent_activities.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">No recent activities</p>
          )}
        </div>
      </Card>
    </div>
  );
}
