import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import TaskDrawer from "./TaskDrawer.jsx";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="page">
          <Outlet />
        </main>
      </div>

      <TaskDrawer />
    </div>
  );
}
