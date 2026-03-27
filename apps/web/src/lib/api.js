import axios from 'axios';
import toast from 'react-hot-toast';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const orgId = localStorage.getItem('orgId');
  if (orgId) config.headers['X-Organization-Id'] = orgId;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          refreshing = refreshing || axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          const { data } = await refreshing;
          refreshing = null;
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api.request(original);
        } catch (refreshErr) {
          refreshing = null;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('orgId');
          localStorage.removeItem('workspaceId');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        }
      } else {
        localStorage.removeItem('accessToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again.');
    } else if (error.code === 'ERR_NETWORK') {
      toast.error('Network error. Check your connection.');
    }

    return Promise.reject(error);
  }
);

export default api;
