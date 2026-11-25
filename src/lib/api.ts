import axios from 'axios';
import { toast } from '../components/ui/Toast';

const getCache = new Map<string, { expiresAt: number; value: unknown }>();
const getInFlight = new Map<string, Promise<unknown>>();
const GET_CACHE_TTL = 60_000;

const cacheKey = (url: string, params?: unknown) => `${url}|${JSON.stringify(params ?? {})}`;

export const cachedGet = async <T>(url: string, params?: unknown): Promise<{ data: T }> => {
  const key = cacheKey(url, params);
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as { data: T };

  const pending = getInFlight.get(key);
  if (pending) return pending as Promise<{ data: T }>;

  const request = api.get<T>(url, { params }).then((response) => {
    getCache.set(key, { expiresAt: Date.now() + GET_CACHE_TTL, value: response });
    getInFlight.delete(key);
    return response;
  }).catch((error) => {
    getInFlight.delete(key);
    throw error;
  });

  getInFlight.set(key, request);
  return request;
};

export const clearGetCache = (urlPrefix?: string) => {
  if (!urlPrefix) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.startsWith(`${urlPrefix}|`)) getCache.delete(key);
  }
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem('auth_token');
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
