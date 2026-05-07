import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon, LogOut, User, Settings, ChevronRight, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '../ui/Dropdown';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

const breadcrumbs = {
  '/app': ['Workspace', 'Dashboard'],
  '/app/projects': ['Workspace', 'Projects'],
  '/app/tasks': ['Workspace', 'Tasks'],
  '/app/tasks/kanban': ['Workspace', 'Tasks', 'Kanban'],
  '/app/documents': ['Workspace', 'Documents'],
  '/app/calendar': ['Workspace', 'Calendar'],
  '/app/goals': ['Workspace', 'Goals'],
  '/app/whiteboards': ['Workspace', 'Whiteboards'],
  '/app/wiki': ['Knowledge', 'Wiki'],
  '/app/helpdesk': ['Support', 'Helpdesk'],
  '/app/automations': ['Automation', 'Workflows'],
  '/app/templates': ['Resources', 'Templates'],
  '/app/reports': ['Insights', 'Reports'],
  '/app/team': ['Manage', 'Team'],
  '/app/settings': ['Manage', 'Settings'],
  '/app/billing': ['Manage', 'Billing'],
  '/app/admin': ['Manage', 'Admin'],
  '/app/profile': ['Account', 'Profile'],
  '/app/notifications': ['Account', 'Notifications'],
};

function SearchPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const items = [
    { label: 'Dashboard', to: '/app', group: 'Workspace' },
    { label: 'Projects', to: '/app/projects', group: 'Workspace' },
    { label: 'Tasks', to: '/app/tasks', group: 'Workspace' },
    { label: 'Documents', to: '/app/documents', group: 'Workspace' },
    { label: 'Calendar', to: '/app/calendar', group: 'Workspace' },
    { label: 'Goals', to: '/app/goals', group: 'Workspace' },
    { label: 'Whiteboards', to: '/app/whiteboards', group: 'Knowledge' },
    { label: 'Wiki', to: '/app/wiki', group: 'Knowledge' },
    { label: 'Helpdesk', to: '/app/helpdesk', group: 'Support' },
    { label: 'Automations', to: '/app/automations', group: 'Automation' },
    { label: 'Templates', to: '/app/templates', group: 'Resources' },
    { label: 'Reports', to: '/app/reports', group: 'Insights' },
    { label: 'Settings', to: '/app/settings', group: 'Manage' },
    { label: 'Team', to: '/app/team', group: 'Manage' },
  ];
  const filtered = q
    ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
    : items;

  const groups = filtered.reduce((acc, it) => {
    acc[it.group] = acc[it.group] || [];
    acc[it.group].push(it);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--bg-overlay)] backdrop-blur-sm p-4 pt-24"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl glass-strong shadow-large"
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--fg-subtle)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Apogee…"
                className="flex-1 bg-transparent text-sm placeholder:text-[var(--fg-subtle)] focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-subtle)]">ESC</kbd>
              <button onClick={onClose} className="sm:hidden text-[var(--fg-subtle)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {Object.keys(groups).length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--fg-subtle)]">No results for &ldquo;{q}&rdquo;</p>
              ) : (
                Object.entries(groups).map(([group, groupItems]) => (
                  <div key={group} className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">{group}</p>
                    {groupItems.map((it) => (
                      <Link
                        key={it.to}
                        to={it.to}
                        onClick={onClose}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--bg-muted)]"
                      >
                        <span>{it.label}</span>
                        <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />
                      </Link>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-2 text-xs text-[var(--fg-subtle)] flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5">↑</kbd><kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5">↓</kbd> Navigate</span>
              <span className="inline-flex items-center gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-0.5">↵</kbd> Open</span>
              <span className="ml-auto inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NotificationMenu() {
  const notifications = [
    { id: 1, title: 'New task assigned', body: 'Design review for Q4 launch', time: '5m', unread: true },
    { id: 2, title: 'Sarah commented', body: 'on “Brand refresh”', time: '20m', unread: true },
    { id: 3, title: 'Build complete', body: 'Deploy to production succeeded', time: '1h', unread: false },
  ];
  return (
    <Dropdown
      align="end"
      className="w-80 p-0"
      trigger={
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-danger-500 ring-2 ring-[var(--bg-elevated)]" />
        </button>
      }
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <DropdownLabel className="p-0">Notifications</DropdownLabel>
        <button className="text-xs font-medium text-brand-600 hover:underline">Mark all read</button>
      </div>
      <DropdownSeparator />
      <div className="max-h-80 overflow-y-auto p-1">
        {notifications.map((n) => (
          <button
            key={n.id}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-[var(--bg-muted)]',
              n.unread && 'bg-brand-50/40 dark:bg-brand-500/5'
            )}
          >
            <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-brand-500' : 'bg-transparent')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--fg)]">{n.title}</p>
              <p className="truncate text-xs text-[var(--fg-subtle)]">{n.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">{n.time} ago</p>
            </div>
          </button>
        ))}
      </div>
      <DropdownSeparator />
      <Link to="/app/notifications" className="block px-3 py-2 text-center text-xs font-medium text-brand-600 hover:underline">
        View all notifications
      </Link>
    </Dropdown>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const name = user?.fullName || user?.name || 'You';
  const email = user?.email || '';
  return (
    <Dropdown
      align="end"
      className="w-64 p-0"
      trigger={
        <button
          className="inline-flex items-center gap-2 rounded-lg p-1 hover:bg-[var(--bg-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="User menu"
        >
          <Avatar name={name} size="sm" />
          <span className="hidden text-sm font-medium text-[var(--fg)] sm:inline">{name.split(' ')[0]}</span>
        </button>
      }
    >
      <div className="px-3 pt-2 pb-1.5">
        <p className="text-sm font-medium text-[var(--fg)]">{name}</p>
        <p className="truncate text-xs text-[var(--fg-subtle)]">{email}</p>
      </div>
      <DropdownSeparator />
      <DropdownItem leftIcon={<User className="h-4 w-4" />} as={Link} to="/app/profile">Profile</DropdownItem>
      <DropdownItem leftIcon={<Settings className="h-4 w-4" />} as={Link} to="/app/settings">Settings</DropdownItem>
      <DropdownItem leftIcon={<Bell className="h-4 w-4" />} as={Link} to="/app/notifications">Notifications</DropdownItem>
      <DropdownSeparator />
      <DropdownItem leftIcon={<LogOut className="h-4 w-4" />} onSelect={logout} className="text-danger-600 data-[highlighted]:!bg-danger-50 data-[highlighted]:!text-danger-700 dark:data-[highlighted]:!bg-danger-500/10">
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}

export default function Topbar({ onMenuClick }) {
  const { dark, toggle } = useThemeStore();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const crumbs = breadcrumbs[location.pathname] || ['Workspace'];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/85 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />}
            <span className={cn(i === crumbs.length - 1 ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-subtle)]')}>{c}</span>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={() => setSearchOpen(true)}
        className="hidden sm:inline-flex h-9 w-64 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/60 px-3 text-sm text-[var(--fg-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--fg-muted)] transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        className="inline-flex sm:hidden h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        aria-label="Search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      <button
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      <NotificationMenu />
      <UserMenu />

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
