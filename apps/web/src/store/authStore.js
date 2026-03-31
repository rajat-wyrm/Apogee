import { create } from 'zustand';
import api from '../lib/api';
import useOrgStore from './orgStore';

const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user });
    useOrgStore.getState().fetchOrganizations();
    return data;
  },

  register: async (email, password, fullName) => {
    const { data } = await api.post('/auth/register', { email, password, fullName });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user });
    useOrgStore.getState().fetchOrganizations();
    return data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('orgId');
    localStorage.removeItem('workspaceId');
    set({ user: null });
  },

  fetchUser: async () => {
    if (!localStorage.getItem('accessToken')) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const endpoints = ['/auth/me', '/users/me'];
      let userData = null;
      for (const ep of endpoints) {
        try {
          const { data } = await api.get(ep);
          userData = data;
          break;
        } catch {}
      }
      set({ user: userData, loading: false });
      if (userData) useOrgStore.getState().fetchOrganizations();
    } catch {
      set({ user: null, loading: false });
    }
  },
}));

export default useAuthStore;
