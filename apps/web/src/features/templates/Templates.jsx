import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { LayoutTemplate, Users, Star } from 'lucide-react';

export default function Templates() {
  const { currentOrganization } = useAuthStore();
  const templates = useQuery({
    queryKey: ['templates', currentOrganization?.id],
    queryFn: () => api.get(`/templates?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-sm text-fg-2 mt-0.5">Start from proven templates</p>
      </div>

      {templates.isLoading ? <Loader /> : templates.data?.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates" description="Browse the public template library or create your own" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.data?.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 text-white flex items-center justify-center text-xl">
                    {t.icon || '📋'}
                  </div>
                  <span className="badge badge-gray">{t.type}</span>
                </div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-xs text-fg-2 mt-1 line-clamp-2">{t.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-fg-3">
                  <span className="flex items-center gap-1"><Users size={12} /> {t.uses_count || 0} uses</span>
                  {t.category && <span className="badge badge-brand">{t.category}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
