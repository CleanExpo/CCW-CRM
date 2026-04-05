'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { notificationsApi, type Notification } from '@/lib/api/notifications';

/** Reads user_id from the auth cookie payload (base64 middle segment). */
function getUserIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(atob(match[1].split('.')[1]));
    return payload.user_id ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

const POLL_INTERVAL_MS = 30_000; // 30 s

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const userId = userIdRef.current ?? getUserIdFromCookie();

  const fetchUnread = useCallback(async () => {
    const uid = getUserIdFromCookie();
    if (!uid) return;
    userIdRef.current = uid;
    try {
      const { count } = await notificationsApi.unreadCount(uid);
      setUnreadCount(count);
    } catch {
      // non-fatal — badge stays stale
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const uid = getUserIdFromCookie();
    if (!uid) return;
    setLoading(true);
    try {
      const data = await notificationsApi.list(uid);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 30 s
  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUnread]);

  // Load full list when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function handleMarkRead(notificationId: string) {
    try {
      await notificationsApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleMarkAll() {
    const uid = getUserIdFromCookie();
    if (!uid) return;
    try {
      await notificationsApi.markAllRead(uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-auto px-1 py-0 text-xs"
              onClick={handleMarkAll}
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {loading ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">No notifications</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'hover:bg-muted cursor-pointer border-b px-4 py-3 last:border-0',
                    !n.is_read && 'bg-primary/5'
                  )}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="bg-primary mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" />
                    )}
                    <div className={cn('min-w-0 flex-1', n.is_read && 'pl-4')}>
                      <p className="text-sm leading-tight font-medium">{n.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                        {n.message}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
