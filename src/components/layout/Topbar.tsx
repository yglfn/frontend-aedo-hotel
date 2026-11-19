import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { ShiftPanel } from '../../features/shifts/ShiftPanel';
import { NotificationBell } from '../../features/notifications/NotificationBell';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

/** Nama halaman per rute akar; dipakai remah jalur di kiri atas. */
const ROUTE_LABEL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reservations': 'Check-In / Out',
  '/reservations/new': 'Reservasi Baru',
  '/rooms': 'Status Kamar',
  '/room-types': 'Tipe Kamar',
  '/customers': 'Pelanggan',
  '/payments': 'Pembayaran',
  '/payments/new': 'Catat Pembayaran',
  '/housekeeping': 'Housekeeping',
  '/maintenance': 'Maintenance',
  '/reports': 'Laporan',
  '/users': 'Pegawai',
  '/settings': 'Pengaturan',
};

export function Topbar() {
  const { user, isAdmin } = useAuth();
  const { pathname } = useLocation();

  // Cocokkan rute terpanjang lebih dulu supaya /payments/new tidak terbaca sebagai /payments
  const aktif =
    Object.keys(ROUTE_LABEL)
      .filter((route) => pathname === route || pathname.startsWith(route + '/'))
      .sort((a, b) => b.length - a.length)[0] || '/dashboard';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <nav className="breadcrumb" aria-label="Lokasi halaman">
          <Link to="/dashboard">Beranda</Link>
          <span className="breadcrumb-pisah" aria-hidden="true">/</span>
          <span className="breadcrumb-now">{ROUTE_LABEL[aktif]}</span>
        </nav>
      </div>
      <div className="topbar-right">
        {!isAdmin && <ShiftPanel />}
        <NotificationBell />
        <div className="topbar-user">
          <div className="topbar-avatar" aria-hidden="true">
            <User size={15} />
          </div>
          <div className="topbar-user-info">
            <div className="topbar-user-name">{user?.name || 'Tamu'}</div>
            <div className="topbar-user-role" style={{ textTransform: 'capitalize' }}>
              {user?.role === 'admin' ? 'Administrator' : 'Pegawai Operasional'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
