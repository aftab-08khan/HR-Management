'use client';

import { usePreferences } from "@/components/saas/preferences";
import { useEffect, useRef, useState } from 'react';
import { ShimmerBlock } from '@/components/saas/dashboard-skeleton';
import { Bell, CheckCheck, ChevronRight, Wifi, WifiOff, X } from 'lucide-react';
function eligible(item, user) {
  if (!user || item.actor === user.email) return false;
  return item.recipientEmail ? item.recipientEmail === user.email : item.audience === 'all' || item.audience === 'managers' && ['admin', 'hr'].includes(user.role);
}
export function useLiveNotifications({
  user,
  isDemo,
  events = [],
  onDemoRead
}) {
  const [remote, setRemote] = useState([]),
    [remoteUnread, setRemoteUnread] = useState(0),
    [received, setReceived] = useState(false),
    [connection, setConnection] = useState('connecting'),
    [error, setError] = useState('');
  const socketRef = useRef(null);
  const email = user?.email,
    role = user?.role,
    workspaceId = user?.workspaceId;
  useEffect(() => {
    if (!user || isDemo || !role || !workspaceId) {
      setConnection(isDemo ? 'demo' : 'offline');
      return;
    }
    setRemote([]);
    setRemoteUnread(0);
    setReceived(false);
    let disposed = false,
      retryTimer,
      attempt = 0;
    function connect() {
      if (disposed) return;
      setConnection(attempt ? 'reconnecting' : 'connecting');
      const url = new URL('/api/live', window.location.href);
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setConnection('live');
        setError('');
      };
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'notifications' && Array.isArray(message.items)) {
            setReceived(true);
            setRemote(message.items);
            setRemoteUnread(Number.isFinite(message.unreadCount) ? message.unreadCount : message.items.filter(item => !item.read).length);
            setConnection('live');
          }
        } catch {}
      };
      socket.onerror = () => {
        if (!disposed) setConnection('reconnecting');
      };
      socket.onclose = event => {
        if (disposed) return;
        if ([4401, 4403, 1008].includes(event.code)) {
          setRemote([]);
          setRemoteUnread(0);
          setConnection('unavailable');
          setError('Workspace access changed. Sign in again to reconnect.');
          return;
        }
        attempt++;
        setConnection('reconnecting');
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      };
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [email, role, workspaceId, isDemo]);
  const items = isDemo ? events.filter(item => eligible(item, user)).map(item => ({
    ...item,
    read: item.readBy?.includes(email) || false
  })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50) : remote;
  async function markRead(id) {
    if (isDemo) {
      onDemoRead(id);
      return;
    }
    const previous = remote,
      previousUnread = remoteUnread;
    setRemoteUnread(id === 'all' ? 0 : Math.max(0, remoteUnread - (remote.some(item => item.id === id && !item.read) ? 1 : 0)));
    setRemote(list => list.map(item => id === 'all' || item.id === id ? {
      ...item,
      read: true
    } : item));
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id
        })
      });
      if (!response.ok) throw Error();
      setError('');
      socketRef.current?.send(JSON.stringify({
        type: 'refresh'
      }));
    } catch {
      setRemote(previous);
      setRemoteUnread(previousUnread);
      setError('Could not mark notifications as read. Please try again.');
    }
  }
  return {
    items,
    unreadCount: isDemo ? items.filter(item => !item.read).length : remoteUnread,
    connection,
    loading: !isDemo && !received && ['connecting', 'reconnecting', 'live'].includes(connection),
    error,
    markRead
  };
}
function relativeTime(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
export function NotificationBell({
  items,
  unreadCount,
  connection,
  loading = false,
  error,
  onRead,
  onNavigate
}) {
  const {
    t
  } = usePreferences();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    function key(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const live = ['live', 'demo'].includes(connection);
  return <div className="notification-wrap" ref={root}><button className="icon-button live-notification-bell" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} aria-controls="notification-inbox" onClick={() => setOpen(!open)}><Bell size={19} /><span className="saas-visually-hidden" aria-live="polite">{unreadCount}{t("unread notifications")}</span>{unreadCount > 0 && <b>{unreadCount > 9 ? '9+' : unreadCount}</b>}</button>{open && <section className="live-notification-panel" id="notification-inbox" aria-label={t("Notification inbox")}><div className="notification-heading"><div><h3>{t("Your notifications")}</h3><span className={`notification-connection ${live ? 'connected' : ''}`}>{live ? <Wifi size={11} /> : <WifiOff size={11} />}{t({
              live: 'Live · WebSocket',
              demo: 'Live demo · this browser',
              connecting: 'Connecting…',
              reconnecting: 'Reconnecting…',
              unavailable: 'Connection unavailable',
              offline: 'Offline'
            }[connection])}</span></div><button className="icon-button" onClick={() => setOpen(false)} aria-label={t("Close notifications")}><X size={17} /></button></div><div className="notification-inbox-toolbar"><span>{unreadCount}{t("unread")}</span><button disabled={!unreadCount} onClick={() => onRead('all')}><CheckCheck size={13} />{t("Mark all read")}</button></div>{error && <p className="notification-error" role="alert">{error}</p>}<div className="notification-items" aria-busy={loading}>{loading && <div className="notification-loading" role="status" aria-label={t("Loading notifications…")}><span className="saas-visually-hidden">{t("Loading notifications…")}</span>{[0,1,2].map(index=><div className="notification-item" key={index} aria-hidden="true"><ShimmerBlock width={30} height={30} circle/><span><ShimmerBlock width="86%" height={11}/><ShimmerBlock width="100%" height={9}/><ShimmerBlock width="48%" height={8}/></span></div>)}</div>}{!loading && items.map(item => <button className={`notification-item ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => {
          onRead(item.id);
          if (item.page) {
            onNavigate(item.page);
            setOpen(false);
          }
        }}><span className="notification-item-icon"><Bell size={15} /></span><span><strong>{item.title}</strong><span>{item.body}</span><small>{relativeTime(item.createdAt)}</small></span>{!item.read && <i />}<ChevronRight size={13} /></button>)}{!loading && !items.length && <div className="notification-inbox-empty"><CheckCheck size={27} /><strong>{t("You\u2019re all caught up.")}</strong><p>{t("Request updates and team news will appear here.")}</p></div>}</div><div className="notification-inbox-footer">{t("Updates for your role and workspace.")}</div></section>}</div>;
}
