import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore, useUIStore, useNotificationStore, usePresenceStore } from '../store';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { Dropdown, Tooltip } from '../components/ui/Overlay';
import { Logo } from '../components/ui/Logo';
import { CommandPalette } from '../components/ui/CommandPalette';
import { AIAssistant } from '../components/ui/AIAssistant';
import { NotificationsPanel } from '../components/ui/NotificationsPanel';
import { OnlineUsers } from '../components/ui/OnlineUsers';
import { useSocket } from '../hooks/useSocket';
import { cn, initials } from '../lib/utils';
import api from '../lib/api';
import {
  LayoutDashboard, FolderKanban, ListTodo, FileText, Calendar, Target, Pencil, BookOpen,
  Ticket, Workflow, LayoutTemplate, BarChart3, Users, Settings, CreditCard, Shield, Search,
  Bell, Sun, Moon, Sparkles, Menu, ChevronsLeft, ChevronsRight, LogOut, ChevronDown, Plus, Inbox, KanbanSquare, Globe, Zap, Command, BellRing, SunMoon, HelpCircle, MessageCircle, Search as SearchIcon, Check
} from 'lucide-react';

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, hotkey: 'G D' },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban, hotkey: 'G P' },
  { to: '/app/tasks', label: 'My Tasks', icon: ListTodo, hotkey: 'G T' },
  { to: '/app/calendar', label: 'Calendar', icon: Calendar },
  { to: '/app/documents', label: 'Documents', icon: FileText },
  { to: '/app/goals', label: 'Goals', icon: Target },
  { to: '/app/whiteboards', label: 'Whiteboards', icon: Pencil },
  { to: '/app/wiki', label: 'Wiki', icon: BookOpen },
  { to: '/app/helpdesk', label: 'Helpdesk', icon: Ticket },
  { to: '/app/automations', label: 'Automations', icon: Workflow },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/team', label: 'Team', icon: Users },
];

const settingsNav = [
  { to: '/app/settings', label: 'General', icon: Settings },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/admin', label: 'Admin', icon: Shield, admin: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, organizations, currentOrganization, currentWorkspace, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, setMobileSidebar, mobileSidebarOpen, theme, setTheme, aiOpen, toggleAI, setCommand, commandOpen } = useUIStore();
  const { unread, setUnread } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [wsList, setWsList] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Real-time updates
  useSocket();

  useEffect(() => {
    if (!currentOrganization) return;
    api.get(`/workspaces?organization_id=${currentOrganization.id}`).then((r) => {
      setWsList(r.data.data || []);
      if (!useAuthStore.getState().currentWorkspace && r.data.data?.[0]) {
        useAuthStore.getState().setCurrentWorkspace(r.data.data[0]);
      }
    }).catch(() => {});
  }, [currentOrganization?.id]);

  useEffect(() => {
    api.get('/notifications/unread-count').then((r) => setUnread(r.data.data.count || 0)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommand(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); toggleAI(); }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setCommand, toggleAI]);

  useEffect(() => { setMobileSidebar(false); }, [location.pathname]);

  return (
    <div className="h-full flex bg-surface text-fg overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden animate-fade" onClick={() => setMobileSidebar(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:relative z-40 lg:z-auto h-full flex flex-col border-r border-default bg-surface transition-all duration-300 ease-out',
          sidebarCollapsed ? 'w-16' : 'w-64',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-default shrink-0">
          <Link to="/app" className="flex items-center gap-2.5 overflow-hidden group">
            <Logo size={32} />
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm gradient-text">Apogee</span>
                <span className="text-[10px] text-fg-3 -mt-0.5">Productivity</span>
              </div>
            )}
          </Link>
          <button onClick={toggleSidebar} className="btn-icon btn-ghost hidden lg:flex" title="Toggle sidebar">
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Org/Workspace switcher */}
        {!sidebarCollapsed && currentOrganization && (
          <div className="px-3 pt-3 relative">
            <button onClick={() => setOrgMenuOpen(!orgMenuOpen)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-3 transition text-left">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {currentOrganization.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{currentOrganization.name}</div>
                <div className="text-[10px] text-fg-3 truncate">{useAuthStore.getState().currentWorkspace?.name || 'Select workspace'}</div>
              </div>
              <ChevronDown size={14} className="text-fg-3 shrink-0" />
            </button>
            {orgMenuOpen && (
              <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-default bg-surface shadow-2xl p-1 animate-fade">
                {organizations.map((o) => (
                  <button key={o.id} onClick={() => { useAuthStore.getState().setCurrentOrganization(o); setOrgMenuOpen(false); }} className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-surface-3', currentOrganization.id === o.id && 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300')}>
                    <div className="h-6 w-6 rounded bg-gradient-to-br from-brand-500 to-purple-500 text-white flex items-center justify-center text-[10px]">{o.name[0]?.toUpperCase()}</div>
                    <span className="truncate flex-1 text-left">{o.name}</span>
                    {currentOrganization.id === o.id && <Check size={12} />}
                  </button>
                ))}
                <div className="divider my-1" />
                <div className="text-[10px] uppercase tracking-wider text-fg-3 px-2 py-1 font-semibold">Workspaces</div>
                <div className="max-h-48 overflow-y-auto">
                  {wsList.map((w) => (
                    <button key={w.id} onClick={() => { useAuthStore.getState().setCurrentWorkspace(w); setOrgMenuOpen(false); }} className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-surface-3', useAuthStore.getState().currentWorkspace?.id === w.id && 'bg-surface-3')}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: w.color || '#6366f1' }} />
                      <span className="truncate flex-1 text-left">{w.name}</span>
                    </button>
                  ))}
                </div>
                <div className="divider my-1" />
                <Link to="/app/settings" onClick={() => setOrgMenuOpen(false)} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-surface-3 text-fg-2">
                  <Settings size={12} /> Organization settings
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {!sidebarCollapsed && <div className="text-[10px] uppercase tracking-wider text-fg-3 font-semibold px-2 mb-1.5">Workspace</div>}
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('nav-item group', isActive && 'nav-item-active', sidebarCollapsed && 'justify-center px-0')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate flex-1">{item.label}</span>}
              {!sidebarCollapsed && item.hotkey && <span className="kbd opacity-0 group-hover:opacity-100 transition">{item.hotkey}</span>}
            </NavLink>
          ))}
          {!sidebarCollapsed && <div className="text-[10px] uppercase tracking-wider text-fg-3 font-semibold px-2 mb-1.5 mt-4">Settings</div>}
          {settingsNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active', sidebarCollapsed && 'justify-center px-0')}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-default space-y-2">
            <button onClick={toggleAI} className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition', aiOpen ? 'bg-gradient-to-r from-brand-500/20 to-purple-500/20 text-brand-700 dark:text-brand-300' : 'hover:bg-surface-3 text-fg-2')}>
              <Sparkles size={14} className="shrink-0" />
              <span className="flex-1 text-left">AI Assistant</span>
              <span className="kbd">⌘J</span>
            </button>
            <button onClick={() => setCommand(true)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-surface-3 text-fg-2">
              <Command size={14} className="shrink-0" />
              <span className="flex-1 text-left">Command palette</span>
              <span className="kbd">⌘K</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-2 px-3 sm:px-4 border-b border-default bg-surface/80 backdrop-blur-xl shrink-0 sticky top-0 z-20">
          <button onClick={() => setMobileSidebar(true)} className="btn-icon btn-ghost lg:hidden">
            <Menu size={18} />
          </button>
          <button onClick={() => setCommand(true)} className="flex-1 max-w-md flex items-center gap-2 px-3 h-9 rounded-lg border border-default bg-surface-2 text-sm text-fg-3 hover:bg-surface-3 transition">
            <SearchIcon size={14} />
            <span className="hidden sm:inline">Search anything…</span>
            <span className="ml-auto kbd hidden sm:inline">⌘K</span>
          </button>
          <div className="flex-1 lg:hidden" />
          <OnlineUsers />
          <Tooltip content="AI Assistant (⌘J)">
            <button onClick={toggleAI} className={cn('btn-icon', aiOpen ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'btn-ghost')}>
              <Sparkles size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Theme">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')} className="btn-icon btn-ghost">
              {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <SunMoon size={18} />}
            </button>
          </Tooltip>
          <div className="relative">
            <Tooltip content="Notifications">
              <button onClick={() => setNotifOpen(!notifOpen)} className="btn-icon btn-ghost relative">
                {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
                {unread > 0 && (
                  <span className="absolute top-0.5 right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-danger text-white text-[10px] flex items-center justify-center font-semibold pulse-ring">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            </Tooltip>
            {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
          </div>
          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-3 transition">
              <Avatar name={user?.full_name} src={user?.avatar_url} size="sm" status="online" />
              <div className="hidden md:block text-left pr-2">
                <div className="text-xs font-medium leading-tight">{user?.full_name?.split(' ')[0]}</div>
                <div className="text-[10px] text-fg-3 leading-tight">{user?.email}</div>
              </div>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-default bg-surface shadow-2xl p-1 z-50 animate-fade">
                <div className="px-3 py-2.5 border-b border-default">
                  <div className="text-sm font-semibold truncate">{user?.full_name}</div>
                  <div className="text-xs text-fg-3 truncate">{user?.email}</div>
                </div>
                <Link to="/app/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-surface-3">
                  <Avatar name={user?.full_name} src={user?.avatar_url} size="xs" /> Profile
                </Link>
                <Link to="/app/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-surface-3">
                  <Settings size={14} /> Settings
                </Link>
                <a href="https://docs.apogee.dev" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-surface-3">
                  <HelpCircle size={14} /> Help & docs
                </a>
                <div className="divider my-1" />
                <button onClick={async () => { await logout(); navigate('/'); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-danger hover:bg-danger/10">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-2">
          <Outlet />
        </main>
      </div>

      {commandOpen && <CommandPalette onClose={() => setCommand(false)} />}
      {aiOpen && <AIAssistant onClose={() => toggleAI()} />}
    </div>
  );
}
