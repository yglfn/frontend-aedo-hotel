/* oxlint-disable react/only-export-components, react/set-state-in-effect */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, cachedGet, clearGetCache } from '../lib/api';
import type { Role } from '../types';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  current_shift?: any;
}

export interface HotelSettings {
  hotel_name: string;
  hotel_address: string;
  hotel_phone?: string;
  hotel_email?: string;
  hotel_photo_url?: string | null;
  tax_percentage?: number;
  // Jam operasional - ditampilkan apa adanya di halaman login supaya petugas punya
  // acuan sebelum melayani tamu (sumber: GET /api/v1/settings, publik).
  default_check_in?: string;
  default_check_out?: string;
  // Aktif = transfer/QRIS menunggu admin; nonaktif = langsung lunas tanpa bukti.
  payment_verification_enabled?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  hotelSettings: HotelSettings;
  isLoading: boolean;
  isAdmin: boolean;
  isPegawai: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultHotelSettings: HotelSettings = {
  hotel_name: 'Aedo Hotel Syariah',
  hotel_address: '',
  hotel_photo_url: null,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  hotelSettings: defaultHotelSettings,
  isLoading: true,
  isAdmin: false,
  isPegawai: false,
  setUser: () => {},
  refreshUser: async () => {},
  refreshSettings: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hotelSettings, setHotelSettings] = useState<HotelSettings>(defaultHotelSettings);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const res = await cachedGet<{ data?: HotelSettings }>('/api/v1/settings');
      if (res.data?.data) {
        setHotelSettings({
          hotel_name: res.data.data.hotel_name || 'Aedo Hotel Syariah',
          hotel_address: res.data.data.hotel_address || '',
          hotel_phone: res.data.data.hotel_phone || '',
          hotel_email: res.data.data.hotel_email || '',
          hotel_photo_url: res.data.data.hotel_photo_url || null,
          tax_percentage: Number(res.data.data.tax_percentage || 0),
          default_check_in: res.data.data.default_check_in || '',
          default_check_out: res.data.data.default_check_out || '',
          payment_verification_enabled: res.data.data.payment_verification_enabled !== false,
        });
      }
    } catch (err) {
      console.error('Failed to load hotel settings', err);
    }
  };

  useEffect(() => {
    const hotelName = hotelSettings.hotel_name || 'Aedo Hotel Syariah';
    document.title = `${hotelName} · Sistem Operasional`;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = hotelSettings.hotel_photo_url || '/favicon.svg';
    }
  }, [hotelSettings.hotel_name, hotelSettings.hotel_photo_url]);

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/v1/auth/me');
      if (res.data?.data) {
        setUser(res.data.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    refreshSettings();
  }, []);

  const logout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {}
    localStorage.removeItem('auth_token');
    clearGetCache();
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'admin' || (typeof user?.role === 'object' && (user?.role as any)?.value === 'admin');
  const isPegawai = user?.role === 'pegawai' || (typeof user?.role === 'object' && (user?.role as any)?.value === 'pegawai');

  return (
    <AuthContext.Provider value={{ 
      user, 
      hotelSettings, 
      isLoading, 
      isAdmin, 
      isPegawai, 
      setUser, 
      refreshUser, 
      refreshSettings, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
