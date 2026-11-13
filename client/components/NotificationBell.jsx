import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import { useData } from "../data.jsx";
import { NOTIFICATION_ICONS } from "../constants.js";
import { timeAgo } from "../utils.js";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const { openTask, version } = useData();
  const ref = useRef(null);

  const load = useCallback(async (quiet = true) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api("/notifications?limit=6");
      setItems(data.notifications);
      setUnread(data.unread_count);
    } catch {
      // ignore
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    load();
  }, [version, load]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function openItem(item) {
    setOpen(false);
    if (!item.is_read) {
      try {
        await api(`/notifications/${item.id}/read`, { method: "POST" });
        setUnread((value) => Math.max(0, value - 1));
        setItems((list) => list.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      } catch {
        // ignore
      }
    }
    if (item.task_id) openTask(item.task_id);
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "POST" });
      setItems((list) => list.map((item) => ({ ...item, is_read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className={`icon-btn topbar-icon ${open ? "active" : ""}`}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) load(false);
        }}
        aria-label="Уведомления"
      >
        <Icon name="bell" size={20} />
        {unread > 0 ? <span className="bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif-popover">
          <div className="notif-popover-head">
            <div>
              <strong>Уведомления</strong>
              {unread > 0 ? <span className="muted-small">{unread} новых</span> : null}
            </div>
            {unread > 0 ? (
              <button type="button" className="link-btn" onClick={markAll}>
                Прочитать все
              </button>
            ) : null}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Загрузка…</div>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-item ${item.is_read ? "" : "unread"}`}
                  onClick={() => openItem(item)}
                >
                  <span className={`notif-icon notif-${item.type}`}>
                    <Icon name={NOTIFICATION_ICONS[item.type] || "bell"} size={16} />
                  </span>
                  <span className="notif-body">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <small>{timeAgo(item.created_at)}</small>
                  </span>
                  {!item.is_read ? <span className="unread-dot" /> : null}
                </button>
              ))
            ) : (
              <div className="notif-empty">
                <Icon name="bell" size={22} />
                Новых уведомлений нет
              </div>
            )}
          </div>

          <Link to="/notifications" className="notif-all" onClick={() => setOpen(false)}>
            Все уведомления
            <Icon name="chevronRight" size={15} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
