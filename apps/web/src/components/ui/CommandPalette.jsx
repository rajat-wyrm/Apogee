import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useCommandStore, useUIStore } from '../../store';
import api from '../../lib/api';
import { cn, initials, colorFromString } from '../../lib/utils';
import {
  Search, Sparkles, ArrowRight, FolderKanban, FileText, User, ListTodo,
  Settings, LayoutDashboard, BookOpen, Target, Calendar, Pencil, Users, BarChart3,
  Workflow, LayoutTemplate, Ticket, Inbox, Plus, Moon, Sun, LogOut, ChevronRight, Command, Sparkle, Lightbulb
} from 'lucide-react';

const actions = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', action: () => '/app' },
  { id: 'nav-projects', label: 'Go to Projects', icon: FolderKanban, shortcut: 'G P', action: () => '/app/projects' },
  { id: 'nav-tasks', label: 'Go to My Tasks', icon: ListTodo, shortcut: 'G T', action: () => '/app/tasks' },
  { id: 'nav-calendar', label: 'Go to Calendar', icon: Calendar, action: () => '/app/calendar' },
  { id: 'nav-documents', label: 'Go to Documents', icon: FileText, action: () => '/app/documents' },
  { id: 'nav-goals', label: 'Go to Goals', icon: Target, action: () => '/app/goals' },
  { id: 'nav-whiteboards', label: 'Go to Whiteboards', icon: Pencil, action: () => '/app/whiteboards' },
  { id: 'nav-wiki', label: 'Go to Wiki', icon: BookOpen, action: () => '/app/wiki' },
  { id: 'nav-helpdesk', label: 'Go to Helpdesk', icon: Ticket, action: () => '/app/helpdesk' },
  { id: 'nav-automations', label: 'Go to Automations', icon: Workflow, action: () => '/app/automations' },
  { id: 'nav-templates', label: 'Go to Templates', icon: LayoutTemplate, action: () => '/app/templates' },
  { id: 'nav-reports', label: 'Go to Reports', icon: BarChart3, action: () => '/app/reports' },
  { id: 'nav-team', label: 'Go to Team', icon: Users, action: () => '/app/team' },
  { id: 'nav-settings', label: 'Go to Settings', icon: Settings, action: () => '/app/settings' },
  { id: 'nav-billing', label: 'Go to Billing', icon: Inbox, action: () => '/app/billing' },
  { id: 'ai-toggle', label: 'Open AI Assistant', icon: Sparkles, shortcut: '⌘J', action: () => useUIStore.getState().toggleAI() },
  { id: 'theme-dark', label: 'Switch to dark theme', icon: Moon, action: () => useUIStore.getState().setTheme('dark') },
  { id: 'theme-light', label: 'Switch to light theme', icon: Sun, action: () => useUIStore.getState().setTheme('light') },
  { id: 'logout', label: 'Sign out', icon: LogOut, action: () => { useAuthStore.getState().logout(); window.location.href = '/'; } },
];

const suggestions = [
  { id: 's1', label: 'Create a new task', icon: Plus, prompt: '/app/tasks' },
  { id: 's2', label: 'Ask AI to summarize my week', icon: Sparkle, prompt: 'ai' },
  { id: 's3', label: 'Open the command palette', icon: Command, prompt: 'palette' },
  { id: 's4', label: 'View my notifications', icon: Inbox, prompt: '/app/notifications' },
];

export function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { currentOrganization, currentWorkspace } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const { data: searchData } = useQuery({
    queryKey: ['cmd-search', q, currentOrganization?.id],
    queryFn: () => {
      if (!q || q.length < 2 || !currentOrganization) return Promise.resolve({ tasks: [], projects: [], documents: [], users: [] });
      return api.get(`/search?q=${encodeURIComponent(q)}&organization_id=${currentOrganization.id}`).then((r) => r.data.data);
    },
    enabled: !!q && q.length >= 2,
  });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allItems = useMemo(() => {
    const items = [];
    if (q && q.length >= 2) {
      (searchData?.tasks || []).slice(0, 5).forEach((t) => items.push({
        id: `task-${t.id}`, label: t.title, sub: `Task · ${t.project_name || ''}`, icon: ListTodo,
        group: 'Tasks', onSelect: () => { navigate(`/app/projects/${t.project_id}?task=${t.id}`); onClose?.(); },
      }));
      (searchData?.projects || []).slice(0, 3).forEach((p) => items.push({
        id: `proj-${p.id}`, label: p.name, sub: 'Project', icon: FolderKanban, group: 'Projects',
        onSelect: () => { navigate(`/app/projects/${p.id}`); onClose?.(); },
      }));
      (searchData?.documents || []).slice(0, 3).forEach((d) => items.push({
        id: `doc-${d.id}`, label: d.title, sub: 'Document', icon: FileText, group: 'Documents',
        onSelect: () => { navigate(`/app/documents/${d.id}`); onClose?.(); },
      }));
      (searchData?.users || []).slice(0, 3).forEach((u) => items.push({
        id: `user-${u.id}`, label: u.full_name, sub: u.email, icon: User, group: 'People',
        onSelect: () => { navigate('/app/team'); onClose?.(); },
      }));
    } else {
      suggestions.forEach((s) => items.push({ id: s.id, label: s.label, icon: s.icon, group: 'Quick actions', onSelect: () => { navigate(s.prompt); onClose?.(); } }));
      actions.forEach((a) => items.push({ id: a.id, label: a.label, icon: a.icon, shortcut: a.shortcut, group: 'Navigation', onSelect: () => { a.action(); onClose?.(); } }));
    }
    return items;
  }, [q, searchData, navigate, onClose]);

  const grouped = useMemo(() => {
    const g = {};
    for (const item of allItems) {
      (g[item.group] = g[item.group] || []).push(item);
    }
    return g;
  }, [allItems]);

  const flat = Object.values(grouped).flat();

  useEffect(() => { setActive(0); }, [q]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); flat[active]?.onSelect?.(); }
  };

  let flatIndex = -1;
  return (
    <div className="fixed inset-0 z-50 animate-fade">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-w-2xl mx-auto mt-[10vh] mx-4">
        <div className="bg-surface rounded-2xl border border-default shadow-2xl overflow-hidden animate-slide-down">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-default">
            <Search size={18} className="text-fg-3 shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search anything or type a command…"
              className="flex-1 bg-transparent focus:outline-none text-sm placeholder:text-fg-3"
            />
            <span className="kbd">ESC</span>
          </div>
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
            {flat.length === 0 ? (
              <div className="px-3 py-12 text-center text-sm text-fg-3">
                {q ? `No results for "${q}"` : 'Start typing to search...'}
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="text-[10px] uppercase tracking-wider text-fg-3 font-semibold px-2 py-1.5">{group}</div>
                  {items.map((item) => {
                    flatIndex++;
                    const isActive = flatIndex === active;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onSelect}
                        onMouseEnter={() => setActive(flatIndex)}
                        className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition', isActive ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-3')}
                      >
                        {Icon && <Icon size={14} className="shrink-0 text-fg-3" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.label}</div>
                          {item.sub && <div className="text-xs text-fg-3 truncate">{item.sub}</div>}
                        </div>
                        {item.shortcut && <span className="kbd">{item.shortcut}</span>}
                        {isActive && <ArrowRight size={12} className="text-fg-3" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="px-3 py-2 border-t border-default bg-surface-2 text-[10px] text-fg-3 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="kbd">↑↓</span> Navigate</span>
            <span className="flex items-center gap-1"><span className="kbd">↵</span> Select</span>
            <span className="flex items-center gap-1"><span className="kbd">⌘K</span> Toggle</span>
            <span className="ml-auto">Powered by Apogee AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
