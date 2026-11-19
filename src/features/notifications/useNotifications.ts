import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export interface AppNotification {
  id: string;
  data: { task_id: number; room_id: number; message: string };
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  unread_count: number;
  data: AppNotification[];
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (document.hidden) return;

    try {
      const response = await api.get<NotificationsResponse>('/api/v1/notifications');
      setNotifications(response.data.data);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchNotifications, 0);
    const interval = window.setInterval(fetchNotifications, 20_000);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await api.post(`/api/v1/notifications/${id}/read`);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await api.post('/api/v1/notifications/read-all');
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
