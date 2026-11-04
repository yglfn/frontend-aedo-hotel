import axios from 'axios';
import { toast } from '../components/ui/Toast';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Clear user state and redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Akun dinonaktifkan saat pemakai masih login: backend menutup sesi, frontend balik ke login
    if (status === 403 && error.response?.data?.message === 'Akun Anda tidak aktif. Hubungi administrator.') {
      toast.warning('Akun Anda sudah dinonaktifkan oleh administrator.', {
        title: 'Sesi berakhir',
        duration: 6000,
      });

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
