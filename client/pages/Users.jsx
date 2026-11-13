import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import { Avatar, EmptyState, PageLoader, RoleBadge } from "../ui.jsx";
import { ROLES, ROLE_MAP } from "../constants.js";
import UserFormModal from "../components/UserFormModal.jsx";
import { useToast } from "../toast.jsx";
import { formatDate, plural } from "../utils.js";

export default function Users() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api("/users?include_inactive=1");
      setUsers(data.users);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((member) => {
      if (role && member.role !== role) return false;
      if (status === "active" && !member.is_active) return false;
      if (status === "inactive" && member.is_active) return false;
      if (!query) return true;
      return `${member.first_name} ${member.last_name} ${member.email} ${member.position}`
        .toLowerCase()
        .includes(query);
    });
  }, [users, search, role, status]);

  const activeCount = users.filter((member) => member.is_active).length;
  const adminCount = users.filter((member) => member.role === "admin" && member.is_active).length;

  async function toggleActive(member) {
    const next = member.is_active ? 0 : 1;
    if (!next) {
      const confirmed = window.confirm(
        `Отключить учётную запись ${member.first_name} ${member.last_name}? Сотрудник не сможет войти в систему.`,
      );
      if (!confirmed) return;
    }
    setBusyId(member.id);
    try {
      await api(`/users/${member.id}`, { method: "PATCH", body: { is_active: next } });
      setUsers((list) =>
        list.map((item) => (item.id === member.id ? { ...item, is_active: next } : item)),
      );
      toast(next ? "Учётная запись включена" : "Учётная запись отключена");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(saved) {
    setUsers((list) => {
      const exists = list.some((item) => item.id === saved.id);
      return exists ? list.map((item) => (item.id === saved.id ? saved : item)) : [...list, saved];
    });
  }

  return (
    <div className="page-stack users-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Администрирование</span>
          <h1>Пользователи</h1>
          <p className="page-subtitle">
            {users.length} {plural(users.length, ["учётная запись", "учётные записи", "учётных записей"])} ·{" "}
            {activeCount} активных · {adminCount} администратор
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-cta" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={17} />
            Создать пользователя
          </button>
        </div>
      </div>

      <div className="filters-bar card">
        <div className="filter-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Поиск по имени, почте или должности"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Все роли</option>
          {ROLES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>

        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Любой статус</option>
          <option value="active">Активные</option>
          <option value="inactive">Отключённые</option>
        </select>

        {search || role || status ? (
          <button
            type="button"
            className="link-btn filter-reset"
            onClick={() => {
              setSearch("");
              setRole("");
              setStatus("");
            }}
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading && !users.length ? <PageLoader label="Загружаем пользователей…" /> : null}

      {!loading && !filtered.length ? (
        <div className="card">
          <EmptyState
            icon="users"
            title="Пользователи не найдены"
            text="Измените поисковый запрос или сбросьте фильтры."
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch("");
                  setRole("");
                  setStatus("");
                }}
              >
                Сбросить фильтры
              </button>
            }
          />
        </div>
      ) : null}

      {filtered.length ? (
        <div className="card table-card users-table-card">
          <table className="task-table users-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Роль</th>
                <th>Должность</th>
                <th>Статус</th>
                <th>В системе с</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id} className={member.is_active ? "" : "row-inactive"}>
                  <td data-label="Сотрудник">
                    <div className="user-cell">
                      <Avatar user={member} size={38} />
                      <div>
                        <strong>{member.first_name} {member.last_name}</strong>
                        <span>{member.email}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Роль">
                    <RoleBadge role={member.role} />
                    <span className="table-role-hint">{ROLE_MAP[member.role]?.label}</span>
                  </td>
                  <td data-label="Должность"><span className="table-muted">{member.position || "—"}</span></td>
                  <td data-label="Статус">
                    <span className={`user-status ${member.is_active ? "is-active" : "is-inactive"}`}>
                      <span className="status-dot" />
                      {member.is_active ? "Активна" : "Отключена"}
                    </span>
                  </td>
                  <td data-label="В системе с"><span className="table-muted">{formatDate(member.created_at)}</span></td>
                  <td data-label="Действия">
                    <div className="user-actions">
                      <button
                        type="button"
                        className="icon-btn icon-btn-ghost"
                        onClick={() => setEditUser(member)}
                        title="Редактировать"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${member.is_active ? "btn-ghost danger-text" : "btn-secondary"}`}
                        onClick={() => toggleActive(member)}
                        disabled={busyId === member.id}
                      >
                        {busyId === member.id ? (
                          <span className="spinner" style={{ width: 14, height: 14 }} />
                        ) : null}
                        {member.is_active ? "Отключить" : "Включить"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <UserFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={handleSaved}
        />
      ) : null}

      {editUser ? (
        <UserFormModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
