import { NavLink } from "react-router-dom";
import Icon from "../icons.jsx";
import { useAuth } from "../auth.jsx";
import { Avatar } from "../ui.jsx";
import { ROLE_MAP } from "../constants.js";

const NAV_ITEMS = [
  { to: "/", end: true, icon: "dashboard", label: "Главная" },
  { to: "/my-tasks", icon: "tasks", label: "Мои задачи" },
  { to: "/projects", icon: "projects", label: "Проекты" },
  { to: "/team", icon: "team", label: "Команда" },
  { to: "/notifications", icon: "bell", label: "Уведомления" },
  { to: "/profile", icon: "settings", label: "Настройки профиля" },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <NavLink to="/" className="brand" onClick={onClose}>
          <span className="brand-mark" aria-hidden="true">
            <img src="/brand/logo-icon.png" alt="" />
          </span>
          <span className="brand-text">
            <strong>NordFlow</strong>
            <small>Tasks</small>
          </span>
        </NavLink>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Закрыть меню">
          <Icon name="close" size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-caption">Рабочее пространство</span>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            onClick={onClose}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {user?.role === "admin" ? (
          <>
            <span className="nav-caption nav-caption-spaced">Администрирование</span>
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Icon name="users" size={19} />
              <span>Пользователи</span>
            </NavLink>
          </>
        ) : null}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <Avatar user={user} size={38} />
          <div className="sidebar-user-text">
            <strong>{user?.first_name} {user?.last_name}</strong>
            <span>{ROLE_MAP[user?.role]?.label}</span>
          </div>
          <button type="button" className="icon-btn icon-btn-ghost" onClick={logout} title="Выйти">
            <Icon name="logout" size={18} />
          </button>
        </div>
        <p className="sidebar-note">NordFlow Tasks · MVP</p>
      </div>
    </aside>
  );
}
