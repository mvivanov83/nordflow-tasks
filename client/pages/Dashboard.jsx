import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  EmptyState,
  PageLoader,
  PriorityBadge,
  ProgressBar,
  ProjectStatusBadge,
  StatusBadge,
} from "../ui.jsx";
import { STATUSES, HISTORY_FIELD_LABELS } from "../constants.js";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import {
  dueMeta,
  formatDate,
  timeAgo,
} from "../utils.js";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function updateSentence(entry) {
  if (entry.action === "created") return "создал(а) задачу";
  if (entry.action === "comment_added") return "оставил(а) комментарий";
  if (entry.action === "comment_deleted") return "удалил(а) комментарий";
  if (entry.action === "attachment_added") return "прикрепил(а) вложение";
  if (entry.action === "attachment_removed") return "удалил(а) вложение";
  if (entry.action === "updated") {
    const field = HISTORY_FIELD_LABELS[entry.field] || entry.field;
    if (entry.field === "description") return "обновил(а) описание";
    return (
      <>
        изменил(а) «{field}»
        {entry.old_value || entry.new_value ? (
          <span className="feed-change"> {entry.old_value} → {entry.new_value}</span>
        ) : null}
      </>
    );
  }
  return "обновил(а) задачу";
}

function loadTone(active) {
  if (active === 0) return { label: "Свободен", tone: "low", value: 4 };
  if (active <= 3) return { label: "Комфортная", tone: "ok", value: active * 22 };
  if (active <= 6) return { label: "Высокая", tone: "warning", value: active * 14 };
  return { label: "Перегрузка", tone: "danger", value: 100 };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { version, openTask } = useData();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/dashboard")
      .then((result) => {
        if (active) setData(result);
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

  if (loading && !data) return <PageLoader />;
  if (error && !data) {
    return (
      <div className="page-error card">
        <Icon name="alert" size={26} />
        <h2>Не удалось загрузить главную</h2>
        <p>{error}</p>
      </div>
    );
  }

  const stats = data.stats;
  const today = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const summary = data.manager_summary;
  const totalManaged = summary
    ? Object.values(summary.by_status).reduce((sum, value) => sum + Number(value), 0)
    : 0;

  return (
    <div className="dashboard page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">{today}</span>
          <h1>{greeting()}, {user.first_name}!</h1>
          <p className="page-subtitle">Краткая сводка по вашим задачам и проектам на сегодня.</p>
        </div>
        <div className="page-header-actions">
          <Link to="/my-tasks" className="btn btn-primary">
            <Icon name="tasks" size={17} />
            Мои задачи
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <Link to="/my-tasks" className="stat-card stat-accent">
          <span className="stat-icon"><Icon name="tasks" size={20} /></span>
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">Активных задач</span>
          <span className="stat-note">Назначено на вас</span>
        </Link>
        <Link to="/my-tasks" className={`stat-card ${stats.overdue ? "stat-danger" : ""}`}>
          <span className="stat-icon"><Icon name="alert" size={20} /></span>
          <span className="stat-value">{stats.overdue}</span>
          <span className="stat-label">Просроченные</span>
          <span className="stat-note">{stats.overdue ? "Требуют внимания" : "Всё под контролем"}</span>
        </Link>
        <Link to="/my-tasks" className="stat-card stat-warning">
          <span className="stat-icon"><Icon name="calendar" size={20} /></span>
          <span className="stat-value">{stats.week}</span>
          <span className="stat-label">На этой неделе</span>
          <span className="stat-note">Дедлайн до воскресенья</span>
        </Link>
        <div className="stat-card stat-success">
          <span className="stat-icon"><Icon name="check" size={20} /></span>
          <span className="stat-value">{stats.completed_week}</span>
          <span className="stat-label">Завершено за 7 дней</span>
          <span className="stat-note">Хороший темп</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card dash-card dash-deadlines">
          <div className="card-head">
            <div>
              <h2>Ближайшие дедлайны</h2>
              <p>Задачи, которые нужно держать в фокусе</p>
            </div>
            <Link to="/my-tasks" className="link-btn">Все задачи</Link>
          </div>

          {data.upcoming_deadlines.length ? (
            <div className="deadline-list">
              {data.upcoming_deadlines.map((task) => {
                const due = dueMeta(task);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="deadline-row"
                    onClick={() => openTask(task.id)}
                  >
                    <span className={`deadline-date tone-${due.tone}`}>
                      <Icon name="calendar" size={16} />
                      {due.text}
                    </span>
                    <span className="deadline-main">
                      <strong>{task.title}</strong>
                      <small>{task.code} · {task.project_name}</small>
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="check" title="Ближайших дедлайнов нет" text="Все задачи выполнены или не имеют срока." />
          )}
        </section>

        <section className="card dash-card dash-projects">
          <div className="card-head">
            <div>
              <h2>Мои проекты</h2>
              <p>{data.my_projects.length} в работе</p>
            </div>
            <Link to="/projects" className="link-btn">Все проекты</Link>
          </div>

          {data.my_projects.length ? (
            <div className="mini-project-list">
              {data.my_projects.map((project) => {
                const progress = project.total_tasks
                  ? Math.round((project.done_tasks / project.total_tasks) * 100)
                  : 0;
                return (
                  <Link key={project.id} to={`/projects/${project.id}`} className="mini-project">
                    <div className="mini-project-top">
                      <strong>{project.name}</strong>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <div className="mini-project-meta">
                      <span><Icon name="tasks" size={14} /> {project.open_tasks} открытых</span>
                      <span><Icon name="team" size={14} /> {project.members_count}</span>
                      <span><Icon name="calendar" size={14} /> {formatDate(project.due_date)}</span>
                    </div>
                    <ProgressBar value={progress} label={`${progress}%`} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="projects" title="Проектов пока нет" text="Вы ещё не добавлены ни в один проект." />
          )}
        </section>

        <section className="card dash-card dash-feed">
          <div className="card-head">
            <div>
              <h2>Последние обновления</h2>
              <p>Что происходит в ваших проектах</p>
            </div>
          </div>

          {data.recent_updates.length ? (
            <div className="feed-list">
              {data.recent_updates.map((entry) => (
                <div key={entry.id} className="feed-row">
                  <Avatar name={entry.actor_name || "Система"} src={entry.actor_avatar} size={32} />
                  <div className="feed-body">
                    <p>
                      <strong>{entry.actor_name || "Система"}</strong> {updateSentence(entry)}{" "}
                      <button type="button" className="feed-task-link" onClick={() => openTask(entry.task_id)}>
                        {entry.task_code}
                      </button>
                    </p>
                    <small>{entry.task_title} · {timeAgo(entry.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="clock" title="Обновлений пока нет" text="Здесь появится история изменений задач." />
          )}
        </section>

        {summary ? (
          <section className="card dash-card dash-summary">
            <div className="card-head">
              <div>
                <h2>Сводка по команде</h2>
                <p>{summary.projects_count} проектов под управлением</p>
              </div>
              <Link to="/team" className="link-btn">Команда</Link>
            </div>

            <div className="summary-numbers">
              <div>
                <strong>{summary.active_tasks}</strong>
                <span>в работе</span>
              </div>
              <div className={summary.overdue_tasks ? "danger-text" : ""}>
                <strong>{summary.overdue_tasks}</strong>
                <span>просрочено</span>
              </div>
              <div>
                <strong>{summary.team.length}</strong>
                <span>в команде</span>
              </div>
            </div>

            <div className="status-distribution">
              {STATUSES.map((status) => {
                const count = Number(summary.by_status[status.id] || 0);
                return (
                  <div key={status.id} className={`dist-${status.id}`} style={{ flex: count || 0.001 }} title={`${status.label}: ${count}`} />
                );
              })}
            </div>
            <div className="distribution-legend">
              {STATUSES.map((status) => (
                <span key={status.id}>
                  <i className={`legend-dot dist-${status.id}`} />
                  {status.label} {Number(summary.by_status[status.id] || 0)}
                </span>
              ))}
            </div>

            <div className="team-load-list">
              {summary.team.map((member) => {
                const load = loadTone(member.active_tasks);
                return (
                  <div key={member.id} className="team-load-row">
                    <Avatar user={member} size={30} />
                    <div className="team-load-main">
                      <div>
                        <strong>{member.first_name} {member.last_name}</strong>
                        <span>{member.active_tasks} задач{member.overdue_tasks ? ` · ${member.overdue_tasks} просрочено` : ""}</span>
                      </div>
                      <ProgressBar value={load.value} tone={load.tone} />
                    </div>
                    <span className={`load-label load-${load.tone}`}>{load.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
