import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { DataProvider } from "./data.jsx";
import { ToastProvider } from "./toast.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MyTasks from "./pages/MyTasks.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Team from "./pages/Team.jsx";
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import Users from "./pages/Users.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import NotFound from "./pages/NotFound.jsx";

function BootScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-brand">
        <span className="brand-mark brand-mark-lg" aria-hidden="true">
          <img src="/brand/logo-main.png" alt="" />
        </span>
        <div>
          <strong>NordFlow</strong>
          <span>Tasks</span>
        </div>
      </div>
      <div className="boot-bar">
        <span />
      </div>
      <p>Загружаем рабочее пространство…</p>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <BootScreen />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Layout />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />

              <Route element={<RequireAuth />}>
                <Route index element={<Dashboard />} />
                <Route path="/my-tasks" element={<MyTasks />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/team" element={<Team />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/search" element={<SearchPage />} />
                <Route
                  path="/users"
                  element={
                    <AdminRoute>
                      <Users />
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
