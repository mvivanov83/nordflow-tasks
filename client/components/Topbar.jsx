import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../icons.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { useAuth } from "../auth.jsx";
import { Avatar } from "../ui.jsx";
import { ROLE_MAP } from "../constants.js";

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (event) => {
      if (!ref.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar-icon menu-btn" onClick={onMenu} aria-label="Открыть меню">
        <Icon name="menu" size={21} />
      </button>

      <GlobalSearch />

      <div className="topbar-actions">
        <NotificationBell />

        <div className="user-menu" ref={ref}>
          <button
            type="button"
            className="user-chip"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Меню профиля"
          >
            <Avatar user={user} size={34} />
            <span className="user-chip-text">
              <strong>{user?.first_name} {user?.last_name}</strong>
              <small>{ROLE_MAP[user?.role]?.label}</small>
            </span>
            <Icon name="chevronDown" size={15} />
          </button>

          {menuOpen ? (
            <div className="user-popover">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/profile");
                }}
              >
                <Icon name="user" size={17} />
                Мой профиль
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/my-tasks");
                }}
              >
                <Icon name="tasks" size={17} />
                Мои задачи
              </button>
              <div className="popover-sep" />
              <button type="button" className="danger-text" onClick={logout}>
                <Icon name="logout" size={17} />
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
