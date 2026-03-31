import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      organizations: [],
      currentOrganization: null,
      currentWorkspace: null,
      loading: false,
      setAccessToken: (t) => set({ accessToken: t }),
      setCurrentOrganization: (o) => { set({ currentOrganization: o }); localStorage.setItem('currentOrg', JSON.stringify(o)); },
      setCurrentWorkspace: (w) => { set({ currentWorkspace: w }); localStorage.setItem('currentWs', JSON.stringify(w)); },
      fetchMe: async () => {
        set({ loading: true });
        try {
          const { data } = await api.get('/auth/me');
          const user = data.data.user;
          const organizations = data.data.organizations;
          set({ user, organizations });
          if (!get().currentOrganization && organizations[0]) {
            get().setCurrentOrganization(organizations[0]);
          }
          return data.data;
        } finally { set({ loading: false }); }
      },
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        if (data.data?.require2fa) return { require2fa: true, userId: data.data.userId };
        set({ accessToken: data.data.access, refreshToken: data.data.refresh, user: { id: data.data.user.id, email: data.data.user.email, full_name: data.data.user.full_name } });
        await get().fetchMe();
        return data.data;
      },
      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload);
        set({ accessToken: data.data.access, refreshToken: data.data.refresh, user: data.data.user });
        await get().fetchMe();
        return data.data;
      },
      loginWithGoogle: () => { window.location.href = '/api/oauth/google'; },
      logout: async () => {
        try { await api.post('/auth/logout', {}); } catch {}
        set({ user: null, accessToken: null, refreshToken: null, organizations: [], currentOrganization: null, currentWorkspace: null });
        localStorage.removeItem('currentOrg');
        localStorage.removeItem('currentWs');
      },
    }),
    { name: 'apogee-auth' }
  )
);

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      aiOpen: false,
      commandOpen: false,
      theme: 'system',
      density: 'comfortable',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebar: (v) => set({ mobileSidebarOpen: v }),
      toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
      setCommand: (v) => set({ commandOpen: v }),
      setTheme: (t) => {
        set({ theme: t });
        const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
      },
      setDensity: (d) => set({ density: d }),
    }),
    { name: 'apogee-ui' }
  )
);

export const useNotificationStore = create((set) => ({
  items: [],
  unread: 0,
  setUnread: (n) => set({ unread: n }),
  setItems: (items) => set({ items }),
  add: (n) => set((s) => ({ items: [n, ...s.items].slice(0, 50), unread: s.unread + 1 })),
  markRead: (id) => set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, read_at: new Date().toISOString() } : i), unread: Math.max(0, s.unread - 1) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read_at: i.read_at || new Date().toISOString() })), unread: 0 })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const useCommandStore = create((set) => ({
  isOpen: false,
  setOpen: (v) => set({ isOpen: v }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  recentItems: [],
  addRecent: (item) => set((s) => ({ recentItems: [item, ...s.recentItems.filter(i => i.id !== item.id)].slice(0, 10) })),
}));

export const usePresenceStore = create((set, get) => ({
  onlineUsers: new Map(),
  setOnline: (userId, status) => set((s) => {
    const m = new Map(s.onlineUsers);
    m.set(userId, { status, lastSeen: Date.now() });
    return { onlineUsers: m };
  }),
  setBatch: (entries) => set((s) => {
    const m = new Map(s.onlineUsers);
    for (const [uid, status] of entries) m.set(uid, { status, lastSeen: Date.now() });
    return { onlineUsers: m };
  }),
  isOnline: (userId) => {
    const u = get().onlineUsers.get(userId);
    return u?.status === 'online' || u?.status === 'away';
  },
}));
