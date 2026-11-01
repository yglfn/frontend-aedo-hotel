import { NavLink } from 'react-router-dom';
import { Home, Calendar, Users, FileText, CheckSquare, Wrench, Settings, LogOut, Briefcase, BarChart3, UserCheck, BedDouble } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../ui/ConfirmDialog';
import './Sidebar.css';

export function Sidebar() {
  const { isAdmin, logout, hotelSettings } = useAuth();

  // Keluar menutup sesi secara total, jadi selalu lewat konfirmasi
  const handleLogout = async () => {
    const leave = await confirmDialog({
      title: 'Keluar dari Sistem?',
      message: 'Sesi login ditutup dan Anda kembali ke halaman masuk.',
      confirmLabel: 'Ya, Keluar',
      tone: 'danger',
    });
    if (!leave) return;
    await logout();
  };

  // Berdasarkan AGENTS.md Bagian 3:
  // Admin: Akses semua menu
  // Pegawai: Dashboard, Reservasi, Kamar (status), Pelanggan, Pembayaran (tanpa verify), Housekeeping (kerjakan), Maintenance (lapor)
  // Pegawai TIDAK BOLEH: CRUD tipe kamar & harga, CRUD Pegawai (Users), Laporan (Reports), Pengaturan (Settings)
  // Dikelompokkan per urusan supaya sidebar terbaca cepat (gaya bersih: label mikro + pil aktif)
  const menuGroups = [
    {
      label: 'Menu Utama',
      items: [
        { icon: <Home size={18} />, label: 'Dashboard', path: '/dashboard', show: true },
        { icon: <Calendar size={18} />, label: 'Check-In / Out', path: '/reservations', show: true },
        { icon: <CheckSquare size={18} />, label: 'Kamar', path: '/rooms', show: true },
        { icon: <UserCheck size={18} />, label: 'Pelanggan', path: '/customers', show: true },
      ],
    },
    {
      label: 'Operasional',
      items: [
        { icon: <FileText size={18} />, label: 'Pembayaran', path: '/payments', show: true },
        { icon: <Briefcase size={18} />, label: 'Housekeeping', path: '/housekeeping', show: true },
        { icon: <Wrench size={18} />, label: 'Maintenance', path: '/maintenance', show: true },
      ],
    },
    {
      label: 'Administrasi',
      items: [
        { icon: <BedDouble size={18} />, label: 'Tipe Kamar', path: '/room-types', show: isAdmin },
        { icon: <BarChart3 size={18} />, label: 'Laporan', path: '/reports', show: isAdmin },
        { icon: <Users size={18} />, label: 'Pegawai', path: '/users', show: isAdmin },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((item) => item.show) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-mark" aria-hidden="true"><BedDouble size={16} strokeWidth={1.75} /></span>
        <span className="sidebar-lockup">
          <span className="sidebar-logo">{hotelSettings?.hotel_name || 'Aedo Hotel Syariah'}</span>
          {hotelSettings?.hotel_address && (
            <span className="sidebar-sub" title={hotelSettings.hotel_address}>{hotelSettings.hotel_address}</span>
          )}
        </span>
      </div>
      <nav className="sidebar-nav">
        {menuGroups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span className="sidebar-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-group-label">Sesi</div>
        {isAdmin && (
          <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-item-icon"><Settings size={18} /></span>
            <span className="sidebar-item-label">Pengaturan</span>
          </NavLink>
        )}
        <button
          className="sidebar-item sidebar-logout"
          onClick={handleLogout}
        >
          <span className="sidebar-item-icon"><LogOut size={18} /></span>
          <span className="sidebar-item-label">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
