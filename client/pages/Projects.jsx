import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  EmptyState,
  PageLoader,
  ProgressBar,
  ProjectStatusBadge,
} from "../ui.jsx";
import { PROJECT_STATUSES } from "../constants.js";
import ProjectFormModal from "../components/ProjectFormModal.jsx";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import { formatDate } from "../utils.js";

const FILTERS = [
  { id: "", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "planning", label: "Планируются" },
  { id: "paused", label: "Приостановлены" },
  { id: "completed", label: "Завершены" },
  { id: "archived", label: "Архив" },
];

export default function Projects() {
  const { user } = useAuth();
  const { version, bump } = useData();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/projects")
      .then((data) => {
        if (active) {
          setProjects(data.projects);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const counts = useMemo(() => {
    const result = { "": projects.length };
    for (const status of PROJECT_STATUSES) {
      result[status.id] = projects.filter((project) => project.status === status.id).length;
    }
    return result;
  }, [projects]);

  const filtered = useMemo(
    () => (filter ? projects.filter((project) => project.status === filter) : projects),
    [projects, filter],
  );

  if (loading && !projects.length) return <PageLoader />;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Проекты</span>
          <h1>Проекты компании</h1>
          <p className="page-subtitle">
            {projects.length} доступных проектов · {counts.active || 0} активных
          </p>
        </div>
        {user.role === "admin" ? (
          <div className="page-header-actions">
            <button type="button" className="btn btn-cta" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={17} />
              Создать проект
            </button>
          </div>
        ) : null}
      </div>

      <div className="filter-chips">
        {FILTERS.map((item) => (
          <button
            key={item.id || "all"}
            type="button"
            className={`chip ${filter === item.id ? "active" : ""}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{counts[item.id] || 0}</span>
          </button>
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((project) => {
            const progress = project.total_tasks
              ? Math.round((project.done_tasks / project.total_tasks) * 100)
              : 0;
            const archived = project.status === "archived";
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className={`project-card card ${archived ? "project-archived" : ""}`}
              >
                <div className="project-card-top">
                  <ProjectStatusBadge status={project.status} />
                  <span className="project-due">
                    <Icon name="calendar" size={14} />
                    до {formatDate(project.due_date)}
                  </span>
                </div>

                <h2>{project.name}</h2>
                <p className="project-desc">{project.description || "Без описания"}</p>

                <div className="project-manager">
                  <Avatar name={project.manager_name} src={project.manager_avatar} size={28} />
                  <div>
                    <small>Руководитель</small>
                    <strong>{project.manager_name}</strong>
                  </div>
                </div>

                <div className="project-stats">
                  <div>
                    <strong>{project.open_tasks}</strong>
                    <span>открытых задач</span>
                  </div>
                  <div>
                    <strong>{project.members_count}</strong>
                    <span>участников</span>
                  </div>
                  <div className={project.overdue_tasks ? "danger-text" : ""}>
                    <strong>{project.overdue_tasks}</strong>
                    <span>просрочено</span>
                  </div>
                </div>

                <div className="project-progress">
                  <div className="project-progress-head">
                    <span>Прогресс</span>
                    <strong>{progress}%</strong>
                  </div>
                  <ProgressBar value={progress} tone={archived ? "muted" : "accent"} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon="projects"
            title={filter ? "В этом статусе проектов нет" : "Доступных проектов нет"}
            text={
              filter
                ? "Выберите другой фильтр, чтобы увидеть остальные проекты."
                : "Администратор добавит вас в проект — и он появится здесь."
            }
            action={
              filter ? (
                <button type="button" className="btn btn-secondary" onClick={() => setFilter("")}>
                  Показать все
                </button>
              ) : null
            }
          />
        </div>
      )}

      {createOpen ? (
        <ProjectFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => bump()}
        />
      ) : null}
    </div>
  );
}
