import { useEffect } from 'react';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Bell, BarChart3, Settings
} from 'lucide-react';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 text-white transition-transform duration-300 md:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4">
          <span className="text-lg font-bold">Apogee</span>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) =>
              `flex items-center gap-3 rounded p-2 ${isActive ? 'bg-blue-600' : 'hover:bg-gray-700'}`
            }>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
