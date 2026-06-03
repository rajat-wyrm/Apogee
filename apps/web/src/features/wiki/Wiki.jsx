import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Loader, EmptyState } from '../../components/ui/Feedback';
import { Plus, BookOpen, Search } from 'lucide-react';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function Wiki() {
  const { currentOrganization } = useAuthStore();
  const qc = useQueryClient();
  const [createSpace, setCreateSpace] = useState(false);
  const [createPage, setCreatePage] = useState(false);
  const [activeSpace, setActiveSpace] = useState(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageContent, setPageContent] = useState('');

  const spaces = useQuery({
    queryKey: ['wiki-spaces', currentOrganization?.id],
    queryFn: () => api.get(`/wiki/spaces?organization_id=${currentOrganization.id}`).then((r) => r.data.data),
    enabled: !!currentOrganization,
  });

  const pages = useQuery({
    queryKey: ['wiki-pages', activeSpace],
    queryFn: () => api.get(`/wiki/spaces/${activeSpace}/pages`).then((r) => r.data.data),
    enabled: !!activeSpace,
  });

  const createSpaceM = useMutation({
    mutationFn: (data) => api.post('/wiki/spaces', { ...data, organization_id: currentOrganization.id }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['wiki-spaces']); setCreateSpace(false); toast.success('Space created'); },
  });

  const createPageM = useMutation({
    mutationFn: (data) => api.post('/wiki/pages', { ...data, wiki_space_id: activeSpace }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries(['wiki-pages']); setCreatePage(false); setPageTitle(''); setPageContent(''); toast.success('Page created'); },
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Wiki</h1>
          <p className="text-sm text-fg-2 mt-0.5">Team knowledge and documentation</p>
        </div>
        <button onClick={() => setCreateSpace(true)} className="btn-primary"><Plus size={14} /> New space</button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <h3 className="text-sm font-semibold mb-2 text-fg-2">Spaces</h3>
          {spaces.isLoading ? <Loader /> : spaces.data?.length === 0 ? (
            <EmptyState icon={BookOpen} title="No spaces" description="Create your first wiki space" />
          ) : (
            <div className="space-y-1">
              {spaces.data?.map((s) => (
                <button key={s.id} onClick={() => setActiveSpace(s.id)} className={`w-full text-left p-3 rounded-lg border transition ${activeSpace === s.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-border hover:bg-surface-3'}`}>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-fg-3 mt-0.5">{s.description || `${s.name} wiki`}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          {activeSpace ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-fg-2">Pages</h3>
                <button onClick={() => setCreatePage(true)} className="btn-secondary btn-sm"><Plus size={12} /> Page</button>
              </div>
              {pages.isLoading ? <Loader /> : pages.data?.length === 0 ? (
                <EmptyState icon={BookOpen} title="No pages" description="Create your first wiki page" />
              ) : (
                <div className="space-y-1.5">
                  {pages.data?.map((p) => (
                    <Card key={p.id} className="hover:shadow-md transition cursor-pointer">
                      <CardContent className="p-4">
                        <h4 className="font-semibold">{p.title}</h4>
                        <div className="text-xs text-fg-3 mt-1">v{p.version} · {formatRelative(p.updated_at)} · {p.views_count} views</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={BookOpen} title="Select a space" description="Pick a wiki space from the left to view its pages" />
          )}
        </div>
      </div>

      <Modal open={createSpace} onClose={() => setCreateSpace(false)} title="New wiki space" size="sm" footer={<><button onClick={() => setCreateSpace(false)} className="btn-secondary">Cancel</button><button form="create-space" type="submit" className="btn-primary">Create</button></>}>
        <form id="create-space" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); createSpaceM.mutate({ name: f.get('name'), description: f.get('description') }); }} className="space-y-3">
          <div><label className="label">Name</label><input name="name" required className="input" placeholder="Engineering" /></div>
          <div><label className="label">Description</label><textarea name="description" rows={2} className="input" /></div>
        </form>
      </Modal>

      <Modal open={createPage} onClose={() => setCreatePage(false)} title="New page" footer={<><button onClick={() => setCreatePage(false)} className="btn-secondary">Cancel</button><button onClick={() => createPageM.mutate({ title: pageTitle, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: pageContent }] }] } })} className="btn-primary">Create</button></>}>
        <div className="space-y-3">
          <div><label className="label">Title</label><input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className="input" placeholder="Onboarding guide" /></div>
          <div><label className="label">Content</label><textarea value={pageContent} onChange={(e) => setPageContent(e.target.value)} rows={5} className="input" placeholder="Write your content…" /></div>
        </div>
      </Modal>
    </div>
  );
}
