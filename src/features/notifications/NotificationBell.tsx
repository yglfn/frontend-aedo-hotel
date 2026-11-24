import {
  Bell as BellIcon,
  BellOff,
  CalendarDays,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Info,
  RotateCw,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/Toast';
import { useNotifications, type AppNotification } from './useNotifications';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  booking: CalendarDays,
  housekeeping: ClipboardCheck,
  payment: CreditCard,
  maintenance: Wrench,
  shift: Clock3,
  reminder: CalendarDays,
};

function actionUrl(notification: AppNotification): string {
  const path = notification.data.action_url;
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/dashboard';
}

export function NotificationBell() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { notifications, unreadCount, isLoading, hasError, markAsRead, markAllAsRead, deleteNotification, clearNotifications, refresh } = useNotifications();
  const visibleNotifications = useMemo(
    () => filter === 'unread' ? notifications.filter((item) => !item.read_at) : notifications,
    [filter, notifications],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) void refresh();
    setIsOpen((open) => !open);
  };

  const handleNotificationClick = (notification: AppNotification) => {
    const target = actionUrl(notification);
    setIsOpen(false);
    navigate(target);

    if (!notification.read_at) {
      void markAsRead(notification.id).catch((error) => {
        console.error('Failed to mark notification as read', error);
        toast.error('Gagal menandai notifikasi.');
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setFilter('all');
      toast.success('Semua notifikasi ditandai dibaca.');
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      toast.error('Gagal menandai semua notifikasi.');
    }
  };

  const handleDeleteNotification = async (notification: AppNotification) => {
    try {
      await deleteNotification(notification.id);
      toast.success('Notifikasi dihapus.');
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast.error('Gagal menghapus notifikasi.');
    }
  };

  const handleClearAll = async () => {
    const confirmed = await confirmDialog({
      title: 'Hapus Semua Notifikasi',
      message: 'Hapus semua notifikasi? Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Hapus Semua',
      cancelLabel: 'Batal',
    });
    if (!confirmed) return;

    try {
      await clearNotifications();
      setFilter('all');
      toast.success('Semua notifikasi dihapus.');
    } catch (error) {
      console.error('Failed to clear notifications', error);
      toast.error('Gagal menghapus semua notifikasi.');
    }
  };

  return (
    <div className="notification-wrapper" ref={wrapperRef}>
      <button
        className="topbar-icon-btn"
        aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <BellIcon size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="region" aria-label="Daftar notifikasi">
          <div className="notification-header">
            <div className="notification-title">
              <strong>Notifikasi</strong>
              {unreadCount > 0 && <span>{unreadCount} belum dibaca</span>}
            </div>
            <button
              type="button"
              className="notification-close"
              aria-label="Tutup notifikasi"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="notification-controls">
            <div className="notification-filters" role="group" aria-label="Filter notifikasi">
              <button
                type="button"
                className={filter === 'all' ? 'is-active' : ''}
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={filter === 'unread' ? 'is-active' : ''}
                aria-pressed={filter === 'unread'}
                onClick={() => setFilter('unread')}
              >
                Belum dibaca <span>{unreadCount}</span>
              </button>
            </div>
            <div className="notification-bulk-actions">
              <button
                type="button"
                className="notification-read-action"
                onClick={() => { void handleMarkAllAsRead(); }}
                disabled={unreadCount === 0}
              >
                <CheckCheck size={14} /> Tandai dibaca
              </button>
              <button
                type="button"
                className="notification-clear-action"
                onClick={() => { void handleClearAll(); }}
                disabled={notifications.length === 0}
              >
                <Trash2 size={14} /> Hapus semua
              </button>
            </div>
          </div>

          {hasError && !isLoading && (
            <div className="notification-error" role="status">
              <span>Gagal memuat notifikasi.</span>
              <button type="button" onClick={() => { void refresh(); }}>
                <RotateCw size={13} /> Coba lagi
              </button>
            </div>
          )}

          <div className="notification-list" aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <div className="notification-skeleton" aria-label="Memuat notifikasi">
                {[0, 1, 2].map((item) => (
                  <div className="notification-skeleton-row" key={item}>
                    <span className="notification-skeleton-icon" />
                    <span className="notification-skeleton-copy"><span /><span /></span>
                  </div>
                ))}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                <span className="notification-empty-icon" aria-hidden="true">
                  {filter === 'unread' && !hasError ? <CheckCheck size={22} /> : <BellOff size={22} />}
                </span>
                <strong>{hasError
                  ? 'Notifikasi belum dapat dimuat.'
                  : filter === 'unread'
                    ? 'Semua notifikasi sudah dibaca.'
                    : 'Belum ada notifikasi.'}</strong>
                {!hasError && <span>{filter === 'unread'
                  ? 'Pilih “Semua” untuk melihat riwayat.'
                  : 'Notifikasi baru akan muncul di sini.'}</span>}
              </div>
            ) : visibleNotifications.map((notification) => {
              const Icon = CATEGORY_ICONS[notification.data.category ?? ''] ?? Info;
              const title = notification.data.title || 'Notifikasi';

              return (
                <div
                  key={notification.id}
                  className={`notification-item${notification.read_at ? '' : ' is-unread'}`}
                >
                  <button
                    type="button"
                    className="notification-item-open"
                    aria-label={`${title}: ${notification.data.message}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className="notification-item-main">
                      <span className="notification-icon" aria-hidden="true">
                        <Icon size={16} />
                        {!notification.read_at && <span className="notification-unread-dot" />}
                      </span>
                      <span className="notification-copy">
                        <strong>{title}</strong>
                        <span>{notification.data.message}</span>
                      </span>
                    </span>
                    <time dateTime={notification.created_at}>
                      {new Date(notification.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                  </button>
                  <button
                    type="button"
                    className="notification-item-delete"
                    aria-label={`Hapus notifikasi ${title}`}
                    title="Hapus notifikasi"
                    onClick={() => { void handleDeleteNotification(notification); }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
