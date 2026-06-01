import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Loader } from '../../components/ui/Feedback';
import { Check, CreditCard, Star, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

const PLANS = [
  { id: 'free', name: 'Free', price: 0, features: ['1 workspace', '5 members', '1GB storage', '50 AI calls/mo', 'Community support'] },
  { id: 'pro', name: 'Pro', price: 12, popular: true, features: ['10 workspaces', '50 members', '100GB storage', '5,000 AI calls/mo', 'Priority support', 'Custom branding', 'Advanced analytics'] },
  { id: 'enterprise', name: 'Enterprise', price: 49, features: ['Unlimited everything', 'SSO/SAML', 'Audit logs', 'Dedicated support', 'SLA', 'On-premise option'] },
];

export default function Billing() {
  const { currentOrganization } = useAuthStore();
  const orgId = currentOrganization?.id;

  const sub = useQuery({
    queryKey: ['subscription', orgId],
    queryFn: () => api.get(`/billing/subscription?organization_id=${orgId}`).then((r) => r.data.data),
    enabled: !!orgId,
  });

  const checkout = useMutation({
    mutationFn: (plan) => api.post('/billing/create-checkout', { organization_id: orgId, plan }).then((r) => r.data),
    onSuccess: (res) => { if (res.data?.url) window.location.href = res.data.url; else { toast.success('Subscribed!'); sub.refetch(); } },
  });

  const cancel = useMutation({
    mutationFn: () => api.post('/billing/cancel', { organization_id: orgId }).then((r) => r.data),
    onSuccess: () => { toast.success('Subscription canceled'); sub.refetch(); },
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-fg-2 mt-0.5">Manage your subscription and payment</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white"><CreditCard size={20} /></div>
            <div>
              <div className="text-lg font-semibold capitalize">{sub.data?.plan || 'free'}</div>
              <div className="text-xs text-fg-3">{sub.data?.status || 'active'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        {PLANS.map((p) => (
          <Card key={p.id} className={cn('relative', p.popular && 'border-brand-500 ring-2 ring-brand-500/20')}>
            {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-500 text-white text-xs font-semibold flex items-center gap-1"><Star size={10} /> Most popular</div>}
            <CardContent className="p-5 text-center">
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-2"><span className="text-3xl font-bold">${p.price}</span><span className="text-fg-3 text-sm">/user/mo</span></div>
              <ul className="mt-4 space-y-1.5 text-left text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={12} className="text-emerald-500 shrink-0" /> {f}</li>
                ))}
              </ul>
              <button
                onClick={() => checkout.mutate(p.id)}
                disabled={sub.data?.plan === p.id}
                className={cn('mt-5 w-full', sub.data?.plan === p.id ? 'btn-secondary cursor-not-allowed' : p.popular ? 'btn-primary' : 'btn-secondary')}
              >
                {sub.data?.plan === p.id ? 'Current plan' : 'Subscribe'}
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {sub.data?.plan !== 'free' && (
        <Card>
          <CardHeader><CardTitle>Manage subscription</CardTitle></CardHeader>
          <CardContent>
            <button onClick={() => cancel.mutate()} className="btn-danger">Cancel subscription</button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
