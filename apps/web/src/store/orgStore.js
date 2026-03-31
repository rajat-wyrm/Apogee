import { create } from 'zustand';
import api from '../lib/api';
import toast from 'react-hot-toast';

const useOrgStore = create((set, get) => ({
  organizations: [],
  selectedOrgId: localStorage.getItem('orgId') || null,
  selectedWorkspaceId: localStorage.getItem('workspaceId') || null,
  loading: false,

  setOrganizations: (orgs) => set({ organizations: orgs }),

  setSelectedOrg: (orgId) => {
    localStorage.setItem('orgId', orgId);
    set({ selectedOrgId: orgId, selectedWorkspaceId: null });
    localStorage.removeItem('workspaceId');
  },

  setSelectedWorkspace: (workspaceId) => {
    localStorage.setItem('workspaceId', workspaceId);
    set({ selectedWorkspaceId: workspaceId });
  },

  fetchOrganizations: async () => {
    try {
      const { data } = await api.get('/organizations');
      set({ organizations: data });
      if (!get().selectedOrgId && data.length > 0) {
        get().setSelectedOrg(data[0].id);
      }
    } catch (err) {
      toast.error('Failed to load organizations');
    }
  },

  createOrganization: async (name, slug) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/organizations', { name, slug });
      await get().fetchOrganizations();
      get().setSelectedOrg(data.id);
      toast.success('Organization created!');
      return data;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Creation failed');
      throw err;
    } finally {
      set({ loading: false });
    }
  },
}));

export default useOrgStore;
