import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store';
import { Search, Sparkles, ArrowRight, FolderKanban, FileText, User, ListTodo, Settings, LayoutDashboard, BookOpen, Target, Calendar, Pencil, Users, BarChart3, Workflow, LayoutTemplate, Ticket } from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../lib/api';

const actions = [
  { id: 'go-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', action: '/app' },
  { id: 'go-projects', label: 'Go to Projects', icon: FolderKanban, shortcut: 'G P', action: '/app/projects' },
  { id: 'go-tasks', label: 'Go to My Tasks', icon: ListTodo, action: '/app/tasks' },
  { id: 'go-documents', label: 'Go to Documents', icon: FileText, action: '/app/documents' },
  { id: 'go-calendar', label: 'Go to Calendar', icon: Calendar, action: '/app/calendar' },
  { id: 'go-goals', label: 'Go to Goals', icon: Target, action: '/app/goals' },
  { id: 'go-whiteboards', label: 'Go to Whiteboards', icon: Pencil, action: '/app/whiteboards' },
  { id: 'go-wiki', label: 'Go to Wiki', icon: BookOpen, action: '/app/wiki' },
  { id: 'go-helpdesk', label: 'Go to Helpdesk', icon: Ticket, action: '/app/helpdesk' },
  { id: 'go-automations', label: 'Go to Automations', icon: Workflow, action: '/app/automations' },
  { id: 'go-templates', label: 'Go to Templates', icon: LayoutTemplate, action: '/app/templates' },
  { id: 'go-reports', label: 'Go to Reports', icon: BarChart3, action: '/app/reports' },
  { id: 'go-team', label: 'Go to Team', icon: Users, action: '/app/team' },
  { id: 'go-settings', label: 'Go to Settings', icon: Settings, action: '/app/settings' },
  { id: 'ai', label: 'Ask AI assistant', icon: Sparkles, shortcut: '⌘J', action: 'ai' },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const { commandOpen, setCommand, toggleAI } = useUIStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [results, setResults] = useState({ tasks: [], projects: [], documents: [], users: [] });
  const inputRef = useRef(null);

  useEffect(() => {
    if (commandOpen) {
      setQ(''); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandOpen]);

  useEffect(() => {
    if (!q || q.length < 2) { setResults({ tasks: [], projects: [], documents: [], users: [] }); return; }
    const t = setTimeout(async () => {
      try {
        const orgId = JSON.parse(localStorage.getItem('apogee-auth') || '{}')?.state?.currentOrganization?.id;
        if (!orgId) return;
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}&organization_id=${orgId}`);
        setResults(data.data);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setCommand(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setCommand]);

  const items = [];
  if (q && q.length >= 2) {
    results.tasks?.forEach((t) => items.push({ id: `task-${t.id}`, label: t.title, sub: `Task in ${t.project_name}`, icon: ListTodo, onSelect: () => { navigate(`/app/projects/${t.project_id}?task=${t.id}`); setCommand(false); } }));
    results.projects?.forEach((p) => items.push({ id: `proj-${p.id}`, label: p.name, sub: 'Project', icon: FolderKanban, onSelect: () => { navigate(`/app/projects/${p.id}`); setCommand(false); } }));
    results.documents?.forEach((d) => items.push({ id: `doc-${d.id}`, label: d.title, sub: 'Document', icon: FileText, onSelect: () => { navigate(`/app/documents/${d.id}`); setCommand(false); } }));
    results.users?.forEach((u) => items.push({ id: `user-${u.id}`, label: u.full_name, sub: u.email, icon: User, onSelect: () => { navigate('/app/team'); setCommand(false); } }));
  } else {
    actions.forEach((a) => items.push({ id: a.id, label: a.label, icon: a.icon, shortcut: a.shortcut, onSelect: () => { if (a.action === 'ai') toggleAI(); else navigate(a.action); setCommand(false); } }));
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); items[active]?.onSelect?.(); }
  };

  if (!commandOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCommand(false)} />
      <div className="relative z-10 max-w-2xl mx-auto mt-20 mx-4">
        <div className="bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden animate-slide-up">
          <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
            <Search size={16} className="text-fg-3" />
            <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder="Search or jump to anywhere…" className="flex-1 bg-transparent focus:outline-none text-sm" />
            <span className="kbd">ESC</span>
          </div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-fg-3">No results</div>
            ) : items.map((item, i) => (
              <button key={item.id} onClick={item.onSelect} onMouseEnter={() => setActive(i)} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition', i === active ? 'bg-brand-100 dark:bg-brand-900/30' : 'hover:bg-surface-2')}>
                {item.icon && <item.icon size={14} className="text-fg-3" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.label}</div>
                  {item.sub && <div className="text-xs text-fg-3 truncate">{item.sub}</div>}
                </div>
                {item.shortcut && <span className="kbd">{item.shortcut}</span>}
                {i === active && <ArrowRight size={12} className="text-fg-3" />}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border bg-surface-2 text-[10px] text-fg-3 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="kbd">↑↓</span> navigate</span>
            <span className="flex items-center gap-1"><span className="kbd">↵</span> select</span>
            <span className="flex items-center gap-1"><span className="kbd">⌘K</span> command</span>
            <span className="ml-auto">Powered by Apogee AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
