import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import { EmptyState, PageLoader } from "../ui.jsx";
import { NOTIFICATION_ICONS } from "../constants.js";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";
import { timeAgo } from "../utils.js";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "unread", label: "Непрочитанные" },
];

export default function Notifications() {
  const { version, bump, openTask } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/notifications?limit=100");
      setItems(data.notifications);
      setUnread(data.unread_count);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const filtered = useMemo(
    () => (filter === "unread" ? items.filter((item) => !item.is_read) : items),
    [items, filter],
  );

  const unreadItems = items.filter((item) => !item.is_read).length;

  async function markAll() {
    if (!unreadItems) return;
    try {
      await api("/notifications/read-all", { method: "POST" });
      setItems((list) => list.map((item) => ({ ...item, is_read: true })));
      setUnread(0);
      toast("Все уведомления прочитаны");
      bump();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function openItem(item) {
    if (!item.is_read) {
      try {
        await api(`/notifications/${item.id}/read`, { method: "POST" });
        setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
        setUnread((value) => Math.max(0, value - 1));
        bump();
      } catch {
        // ignore read errors — opening the target is more important
      }
    }
    if (item.task_id) openTask(item.task_id);
    else if (item.project_id) navigate(`/projects/${item.project_id}`);
  }

  async function removeItem(item) {
    try {
      await api(`/notifications/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((entry) => entry.id !== item.id));
      if (!item.is_read) setUnread((value) => Math.max(0, value - 1));
      toast("Уведомление удалено");
      bump();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="page-stack notifications-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Уведомления</span>
          <h1>Центр уведомлений</h1>
          <p className="page-subtitle">
            Назначения, изменения сроков, статусы и комментарии по вашим задачам.
            {unread ? <span className="danger-text"> Непрочитанных: {unread}.</span> : " Все прочитано."}
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={markAll} disabled={!unreadItems}>
            <Icon name="check" size={16} />
            Прочитать все
          </button>
        </div>
      </div>

      <div className="filter-chips">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${filter === item.id ? "active" : ""}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{item.id === "unread" ? unreadItems : items.length}</span>
          </button>
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading && !items.length ? <PageLoader label="Загружаем уведомления…" /> : null}

      {!loading && !filtered.length ? (
        <div className="card">
          <EmptyState
            icon="bell"
            title={filter === "unread" ? "Непрочитанных уведомлений нет" : "Уведомлений пока нет"}
            text={
              filter === "unread"
                ? "Вы посмотрели все новые события. Загляните позже."
                : "Здесь появятся назначения задач, смена статусов, дедлайны и комментарии."
            }
            action={
              filter === "unread" ? (
                <button type="button" className="btn btn-secondary" onClick={() => setFilter("all")}>
                  Показать все
                </button>
              ) : null
            }
          />
        </div>
      ) : null}

      {filtered.length ? (
        <div className="card notif-page-list">
          {filtered.map((item) => (
            <div key={item.id} className={`notif-page-item ${item.is_read ? "" : "unread"}`}>
              <button type="button" className="notif-page-main" onClick={() => openItem(item)}>
                <span className={`notif-icon notif-${item.type}`}>
                  <Icon name={NOTIFICATION_ICONS[item.type] || "bell"} size={18} />
                </span>
                <span className="notif-page-body">
                  <span className="notif-page-title">
                    <strong>{item.title}</strong>
                    {!item.is_read ? <span className="unread-dot" /> : null}
                    <small>{timeAgo(item.created_at)}</small>
                  </span>
                  <span className="notif-page-text">{item.body}</span>
                  {item.task_code ? (
                    <span className="notif-page-task">
                      <Icon name="tasks" size={13} />
                      {item.task_code} · {item.task_title}
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-ghost notif-page-delete danger-text"
                onClick={() => removeItem(item)}
                title="Удалить уведомление"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
