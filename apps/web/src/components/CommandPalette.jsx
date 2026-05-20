import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Bell, BarChart3, Settings, Moon, Sun, LogOut
} from 'lucide-react';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { dark, toggle } = useThemeStore();
  const logout = useAuthStore((s) => s.logout);

  // Toggle with Ctrl+K
  const down = useCallback((e) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [down]);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg glass rounded-xl overflow-hidden">
            <Command label="Command Menu">
              <Command.Input placeholder="Type a command..." className="w-full bg-transparent px-4 py-3 text-lg text-gray-800 dark:text-white outline-none placeholder-gray-400" />
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Group heading="Navigate">
                  <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))} icon={LayoutDashboard} label="Dashboard" />
                  <CommandItem onSelect={() => runCommand(() => navigate('/projects'))} icon={FolderKanban} label="Projects" />
                  <CommandItem onSelect={() => runCommand(() => navigate('/tasks'))} icon={CheckSquare} label="Tasks" />
                  <CommandItem onSelect={() => runCommand(() => navigate('/notifications'))} icon={Bell} label="Notifications" />
                  <CommandItem onSelect={() => runCommand(() => navigate('/analytics'))} icon={BarChart3} label="Analytics" />
                  <CommandItem onSelect={() => runCommand(() => navigate('/settings'))} icon={Settings} label="Settings" />
                </Command.Group>
                <Command.Group heading="Actions">
                  <CommandItem onSelect={() => runCommand(toggle)} icon={dark ? Sun : Moon} label={dark ? 'Light Mode' : 'Dark Mode'} />
                  <CommandItem onSelect={() => runCommand(logout)} icon={LogOut} label="Logout" />
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}

function CommandItem({ onSelect, icon: Icon, label }) {
  return (
    <Command.Item onSelect={onSelect} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
      <Icon size={18} />
      <span>{label}</span>
    </Command.Item>
  );
}
