import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

export interface AppNotification {
  id: string;
  data: {
    category?: string;
    event?: string;
    title?: string;
    message: string;
    action_url?: string;
    task_id?: number;
    room_id?: number;
    booking_id?: number;
    payment_id?: number;
    maintenance_id?: number;
    shift_id?: number;
  };
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestSeq = useRef(0);
  const hasLoaded = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (document.hidden) return;

    const requestId = ++requestSeq.current;
    if (!hasLoaded.current) setIsLoading(true);

    try {
      const response = await api.get<NotificationsResponse>('/api/v1/notifications');
      if (requestId !== requestSeq.current) return;

      hasLoaded.current = true;
      setIsLoading(false);
      setHasError(false);
      setNotifications(response.data.data);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      if (requestId === requestSeq.current) {
        setIsLoading(false);
        setHasError(true);
        console.error('Failed to fetch notifications', error);
      }
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchNotifications, 0);
    const interval = window.setInterval(fetchNotifications, 15_000);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', fetchNotifications);
    return () => {
      requestSeq.current += 1;
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    const wasUnread = notifications.some((item) => item.id === id && !item.read_at);
    await api.post(`/api/v1/notifications/${id}/read`);
    requestSeq.current += 1;
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    await api.post('/api/v1/notifications/read-all');
    requestSeq.current += 1;
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    await api.delete(`/api/v1/notifications/${id}`);
    requestSeq.current += 1;
    setNotifications((items) => items.filter((item) => item.id !== id));
    if (target && !target.read_at) setUnreadCount((count) => Math.max(0, count - 1));
  }, [notifications]);

  const clearNotifications = useCallback(async () => {
    await api.delete('/api/v1/notifications');
    requestSeq.current += 1;
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    hasError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    refresh: fetchNotifications,
  };
}
