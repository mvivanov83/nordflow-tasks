import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [version, setVersion] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [taskId, setTaskId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("task");
    return value ? Number(value) : null;
  });

  useEffect(() => {
    const value = new URLSearchParams(location.search).get("task");
    setTaskId(value ? Number(value) : null);
  }, [location.pathname, location.search]);

  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const openTask = useCallback((id) => {
    if (!id) return;
    const params = new URLSearchParams(location.search);
    params.set("task", String(id));
    setTaskId(Number(id));
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}` },
      { replace: false },
    );
  }, [navigate, location.pathname, location.search]);

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete("task");
    setTaskId(null);
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [navigate, location.pathname, location.search]);

  const value = useMemo(
    () => ({ version, bump, taskId, openTask, closeTask, setTaskId }),
    [version, bump, taskId, openTask, closeTask],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData должен использоваться внутри DataProvider");
  return context;
}

export function useTaskDrawer() {
  const { taskId, openTask, closeTask } = useData();
  return { taskId, openTask, closeTask };
}
