import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);

export function applyTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value;
  localStorage.setItem("nordflow_theme", value);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api("/auth/me");
      setUser(data.user);
      applyTheme(data.user.theme);
      return data.user;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("nordflow:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("nordflow:unauthorized", handleUnauthorized);
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(data.token);
    setUser(data.user);
    applyTheme(data.user.theme);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.assign("/login");
  }, []);

  const updateUser = useCallback((next) => {
    setUser(next);
    if (next?.theme) applyTheme(next.theme);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return context;
}
