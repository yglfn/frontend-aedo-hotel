import { Bell as BellIcon, User } from 'lucide-react';
import { ShiftPanel } from '../../features/shifts/ShiftPanel';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

export function Topbar() {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">Sistem Aedo Hotel</h2>
      </div>
      <div className="topbar-right">
        <ShiftPanel />
        <button className="topbar-icon-btn" aria-label="Notifikasi">
          <BellIcon size={20} />
        </button>
        <div className="topbar-user">
          <div className="topbar-avatar">
            <User size={16} />
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
