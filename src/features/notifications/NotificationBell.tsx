import { Bell as BellIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './useNotifications';

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = async (id: string) => {
    await markAsRead(id);
    setIsOpen(false);
    navigate('/housekeeping');
  };

  return (
    <div className="notification-wrapper">
      <button
        className="topbar-icon-btn"
        aria-label="Notifikasi"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <BellIcon size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <strong>Notifikasi</strong>
            <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Tandai semua dibaca
            </button>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">Belum ada notifikasi.</div>
            ) : notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-item${notification.read_at ? '' : ' is-unread'}`}
                onClick={() => handleNotificationClick(notification.id)}
              >
                <span>{notification.data.message}</span>
                <small>{new Date(notification.created_at).toLocaleString('id-ID')}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
