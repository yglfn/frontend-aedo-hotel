import { NavLink } from 'react-router-dom';
import { Home, Calendar, Users, FileText, CheckSquare, Wrench, Settings, LogOut, Briefcase, BarChart3, UserCheck, BedDouble } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export function Sidebar() {
  const { isAdmin, logout, hotelSettings } = useAuth();

  // Berdasarkan AGENTS.md Bagian 3:
  // Admin: Akses semua menu
  // Pegawai: Dashboard, Reservasi, Kamar (status), Pelanggan, Pembayaran (tanpa verify), Housekeeping (kerjakan), Maintenance (lapor)
  // Pegawai TIDAK BOLEH: CRUD tipe kamar & harga, CRUD Pegawai (Users), Laporan (Reports), Pengaturan (Settings)
  const menuItems = [
    { icon: <Home size={20} />, label: 'Dashboard', path: '/dashboard', show: true },
    { icon: <Calendar size={20} />, label: 'Check-In / Out', path: '/reservations', show: true },
    { icon: <CheckSquare size={20} />, label: 'Kamar', path: '/rooms', show: true },
    { icon: <BedDouble size={20} />, label: 'Tipe Kamar', path: '/room-types', show: isAdmin },
    { icon: <UserCheck size={20} />, label: 'Pelanggan', path: '/customers', show: true },
    { icon: <FileText size={20} />, label: 'Pembayaran', path: '/payments', show: true },
    { icon: <Briefcase size={20} />, label: 'Housekeeping', path: '/housekeeping', show: true },
    { icon: <Wrench size={20} />, label: 'Maintenance', path: '/maintenance', show: true },
    { icon: <BarChart3 size={20} />, label: 'Laporan', path: '/reports', show: isAdmin },
    { icon: <Users size={20} />, label: 'Pegawai', path: '/users', show: isAdmin },
  ].filter((item) => item.show);

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
        <h1 className="sidebar-logo" style={{ lineHeight: 1.2 }}>{hotelSettings?.hotel_name || 'Aedo Hotel Syariah'}</h1>
        {hotelSettings?.hotel_address && (
          <span style={{ fontSize: '10px', color: 'var(--ink-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', marginTop: '2px' }} title={hotelSettings.hotel_address}>
            {hotelSettings.hotel_address}
          </span>
        )}
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-group-label">MENU UTAMA</div>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {isAdmin && (
          <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <span className="sidebar-item-icon"><Settings size={20} /></span>
            <span className="sidebar-item-label">Pengaturan</span>
          </NavLink>
        )}
        <button
          className="sidebar-item sidebar-logout"
          onClick={logout}
        >
          <span className="sidebar-item-icon"><LogOut size={20} /></span>
          <span className="sidebar-item-label">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
