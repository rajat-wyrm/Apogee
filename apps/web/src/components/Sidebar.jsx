import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Bell, BarChart3, Settings,
  ChevronLeft, ChevronRight, Moon, Sun, Sparkles, Plus, X, Menu, Loader2,
  FileText, Calendar, Target, PenTool, BookOpen, HeadphonesIcon, Workflow,
  LayoutTemplate, Users, CreditCard, ShieldCheck, Search, LogOut, Building2
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import useOrgStore from '../store/orgStore';
import { Tooltip, TooltipProvider } from './ui/Tooltip';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const primaryLinks = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/app/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/app/documents', icon: FileText, label: 'Documents' },
  { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
];

const secondaryLinks = [
  { to: '/app/goals', icon: Target, label: 'Goals' },
  { to: '/app/whiteboards', icon: PenTool, label: 'Whiteboards' },
  { to: '/app/wiki', icon: BookOpen, label: 'Wiki' },
  { to: '/app/helpdesk', icon: HeadphonesIcon, label: 'Helpdesk' },
  { to: '/app/automations', icon: Workflow, label: 'Automations' },
  { to: '/app/templates', icon: LayoutTemplate, label: 'Templates' },
];

const bottomLinks = [
  { to: '/app/reports', icon: BarChart3, label: 'Reports' },
  { to: '/app/team', icon: Users, label: 'Team' },
  { to: '/app/billing', icon: CreditCard, label: 'Billing' },
  { to: '/app/admin', icon: ShieldCheck, label: 'Admin' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
];

const allLinks = [...primaryLinks, ...secondaryLinks, ...bottomLinks];

function SidebarLink({ to, icon: Icon, label, collapsed, badge }) {
  const link = (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-brand-50 text-brand-700 shadow-soft dark:bg-brand-500/15 dark:text-brand-200'
            : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]',
          collapsed && 'justify-center px-2'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-brand-600 dark:text-brand-400')} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {badge && <Badge tone="brand" size="sm">{badge}</Badge>}
            </>
          )}
          {isActive && !collapsed && (
            <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-brand-600 dark:bg-brand-400" />
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        {link}
      </Tooltip>
    );
  }
  return link;
}

function NavGroup({ title, children, collapsed }) {
  if (collapsed) return <div className="space-y-1">{children}</div>;
  return (
    <div className="space-y-1">
      <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function Sidebar({ collapsed, setCollapsed, onNavigate }) {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { dark, toggle } = useThemeStore();
  const { organizations, selectedOrgId, setSelectedOrg, createOrganization, fetchOrganizations, loading } = useOrgStore();
  const [showOrgCreate, setShowOrgCreate] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (organizations.length === 0) fetchOrganizations();
  }, [organizations.length, fetchOrganizations]);

  const handleOrgCreate = useCallback(async (e) => {
    e.preventDefault();
    const name = orgName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    try {
      await createOrganization(name, slug);
      setOrgName('');
      setShowOrgCreate(false);
    } catch {}
  }, [orgName, createOrganization]);

  const content = (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex h-full flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] transition-[width] duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
        aria-label="Primary navigation"
      >
        <div className={cn('flex h-14 items-center border-b border-[var(--border)]', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {!collapsed ? (
            <Link to="/app" className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
                <Sparkles className="h-4 w-4" />
              </span>
              <span>Apogee</span>
            </Link>
          ) : (
            <Link to="/app" className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-glow" aria-label="Home">
              <Sparkles className="h-4 w-4" />
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="border-b border-[var(--border)] p-3">
            <label className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              <Building2 className="h-3 w-3" /> Organization
            </label>
            {organizations.length === 0 && !showOrgCreate ? (
              <Button
                onClick={() => setShowOrgCreate(true)}
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Create organization
              </Button>
            ) : showOrgCreate ? (
              <form onSubmit={handleOrgCreate} className="space-y-2">
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-3 w-3 animate-spin" />} Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOrgCreate(false)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <select
                  value={selectedOrgId || ''}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <Tooltip content="New organization">
                  <button
                    onClick={() => setShowOrgCreate(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-2 overflow-y-auto p-2" onClick={onNavigate}>
          <NavGroup title="Workspace" collapsed={collapsed}>
            {primaryLinks.map((l) => (
              <SidebarLink key={l.to} {...l} collapsed={collapsed} />
            ))}
          </NavGroup>
          {!collapsed && <div className="divider-soft mx-3 my-2" />}
          <NavGroup title="Knowledge" collapsed={collapsed}>
            {secondaryLinks.map((l) => (
              <SidebarLink key={l.to} {...l} collapsed={collapsed} />
            ))}
          </NavGroup>
          {!collapsed && <div className="divider-soft mx-3 my-2" />}
          <NavGroup title="Manage" collapsed={collapsed}>
            {bottomLinks.map((l) => (
              <SidebarLink key={l.to} {...l} collapsed={collapsed} />
            ))}
          </NavGroup>
        </nav>

        <div className="border-t border-[var(--border)] p-2 space-y-1">
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="hidden md:inline-flex h-9 w-full items-center justify-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <Tooltip content={dark ? 'Light mode' : 'Dark mode'} side="right">
            <button
              onClick={toggle}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors',
                collapsed && 'justify-center px-2'
              )}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
            </button>
          </Tooltip>
          <Tooltip content="Sign out" side="right">
            <button
              onClick={logout}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-danger-50 hover:text-danger-700 dark:hover:bg-danger-500/10 dark:hover:text-danger-300 transition-colors',
                collapsed && 'justify-center px-2'
              )}
            >
              <LogOut className="h-[18px] w-[18px]" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );

  return content;
}
