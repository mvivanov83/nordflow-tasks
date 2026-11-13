import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  EmptyState,
  Field,
  Modal,
  PageLoader,
  PriorityBadge,
  ProgressBar,
  ProjectStatusBadge,
  Spinner,
  StatusBadge,
} from "../ui.jsx";
import {
  PRIORITIES,
  PRIORITY_MAP,
  STATUSES,
  STATUS_MAP,
} from "../constants.js";
import KanbanBoard from "../components/KanbanBoard.jsx";
import TaskFormModal from "../components/TaskFormModal.jsx";
import ProjectFormModal from "../components/ProjectFormModal.jsx";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";
import {
  dueMeta,
  formatDate,
  formatDateTime,
  isTaskOverdue,
  sortByPriority,
} from "../utils.js";

const TABS = [
  { id: "board", label: "Доска", icon: "grid" },
  { id: "list", label: "Список задач", icon: "list" },
  { id: "members", label: "Участники", icon: "team" },
  { id: "info", label: "Информация", icon: "folder" },
];

function AddMemberModal({ project, onClose, onAdded }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    api("/users")
      .then((data) => {
        const existing = new Set(project.members.map((member) => member.id));
        const available = data.users.filter((user) => !existing.has(user.id));
        setUsers(available);
        setUserId(available[0]?.id || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [project]);

  async function submit(event) {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      await api(`/projects/${project.id}/members`, {
        method: "POST",
        body: { user_id: Number(userId), can_create_tasks: canCreate },
      });
      toast("Участник добавлен в проект");
      onAdded?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Добавить участника"
      subtitle={`Проект «${project.name}»`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" form="add-member-form" className="btn btn-primary" disabled={saving || !userId}>
            {saving ? <Spinner size={16} /> : null}
            Добавить
          </button>
        </>
      }
    >
      <form id="add-member-form" className="form" onSubmit={submit}>
        {error ? <div className="form-error">{error}</div> : null}
        {loading ? <PageLoader label="Загружаем сотрудников…" /> : null}
        {!loading && !users.length ? (
          <p className="muted">Все активные сотрудники уже добавлены в проект.</p>
        ) : null}
        {users.length ? (
          <>
            <Field label="Сотрудник">
              <select value={userId} onChange={(event) => setUserId(event.target.value)}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} — {user.position || user.email}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={canCreate}
                onChange={(event) => setCanCreate(event.target.checked)}
              />
              <span>Разрешить создавать задачи в этом проекте</span>
            </label>
          </>
        ) : null}
      </form>
    </Modal>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { version, bump, openTask } = useData();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState("backlog");
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [listFilters, setListFilters] = useState({ search: "", status: "", assignee: "" });

  const tabParam = searchParams.get("tab");
  const tab = TABS.some((item) => item.id === tabParam) ? tabParam : "board";

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api(`/projects/${id}`),
      api(`/tasks?project_id=${id}&limit=1000`),
    ])
      .then(([projectData, taskData]) => {
        if (!active) return;
        setDetail(projectData);
        setTasks(taskData.tasks);
        setError("");
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
  }, [id, version]);

  function changeTab(next) {
    const params = new URLSearchParams(searchParams);
    if (next === "board") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const project = detail?.project;
  const members = detail?.members || [];
  const permissions = project?.my_permissions || {};

  const canManage = Boolean(permissions.can_manage);
  const canCreate = Boolean(permissions.can_create_tasks);

  function canEditTask(task) {
    return (
      user.role === "admin" ||
      permissions.is_manager ||
      task.reporter_id === user.id
    );
  }

  function canMoveTask(task) {
    return (
      user.role === "admin" ||
      permissions.is_manager ||
      task.assignee_id === user.id
    );
  }

  async function moveTask(task, status) {
    const previous = tasks;
    setTasks((list) =>
      list.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    try {
      await api(`/tasks/${task.id}/status`, { method: "PATCH", body: { status } });
      toast(`Статус задачи ${task.code} изменён`);
      bump();
    } catch (err) {
      setTasks(previous);
      toast(err.message, "error");
    }
  }

  async function toggleCanCreate(member) {
    try {
      await api(`/projects/${id}/members/${member.id}`, {
        method: "PATCH",
        body: { can_create_tasks: !member.can_create_tasks },
      });
      toast(
        member.can_create_tasks
          ? `${member.first_name} больше не может создавать задачи`
          : `${member.first_name} может создавать задачи`,
      );
      bump();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Удалить ${member.first_name} ${member.last_name} из проекта?`)) return;
    try {
      await api(`/projects/${id}/members/${member.id}`, { method: "DELETE" });
      toast("Участник удалён из проекта");
      bump();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function archiveProject() {
    if (!window.confirm("Переместить проект в архив? Задачи и история сохранятся.")) return;
    try {
      await api(`/projects/${id}/archive`, { method: "POST" });
      toast("Проект архивирован");
      bump();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function quickStatus(task, status) {
    await moveTask(task, status);
  }

  const filteredTasks = useMemo(() => {
    const search = listFilters.search.trim().toLowerCase();
    return sortByPriority(
      tasks.filter((task) => {
        if (search && !`${task.title} ${task.code}`.toLowerCase().includes(search)) return false;
        if (listFilters.status && task.status !== listFilters.status) return false;
        if (listFilters.assignee && String(task.assignee_id) !== listFilters.assignee) return false;
        return true;
      }),
    );
  }, [tasks, listFilters]);

  if (loading && !detail) return <PageLoader />;
  if (error && !detail) {
    return (
      <div className="page-error card">
        <Icon name="alert" size={28} />
        <h2>Проект недоступен</h2>
        <p>{error}</p>
        <Link to="/projects" className="btn btn-secondary">Вернуться к проектам</Link>
      </div>
    );
  }
  if (!project) return null;

  const progress = project.total_tasks
    ? Math.round((project.done_tasks / project.total_tasks) * 100)
    : 0;

  return (
    <div className="page-stack project-page">
      <div className="project-head">
        <Link to="/projects" className="back-link">
          <Icon name="arrowLeft" size={16} />
          Все проекты
        </Link>

        <div className="project-head-row">
          <div className="project-head-main">
            <div className="project-head-badges">
              <ProjectStatusBadge status={project.status} />
              <span className="project-code">Проект #{project.id}</span>
            </div>
            <h1>{project.name}</h1>
            <p>{project.description || "Описание проекта не заполнено."}</p>
          </div>

          <div className="project-head-actions">
            {canCreate && project.status !== "archived" ? (
              <button
                type="button"
                className="btn btn-cta"
                onClick={() => {
                  setCreateStatus("backlog");
                  setCreateOpen(true);
                }}
              >
                <Icon name="plus" size={17} />
                Создать задачу
              </button>
            ) : null}
            {canManage ? (
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
                <Icon name="edit" size={16} />
                Редактировать
              </button>
            ) : null}
            {user.role === "admin" && project.status !== "archived" ? (
              <button type="button" className="btn btn-ghost" onClick={archiveProject}>
                <Icon name="archive" size={16} />
                В архив
              </button>
            ) : null}
          </div>
        </div>

        <div className="project-meta-row">
          <div className="project-meta-item">
            <Avatar name={project.manager_name} src={project.manager_avatar} size={30} />
            <div>
              <small>Руководитель</small>
              <strong>{project.manager_name}</strong>
            </div>
          </div>
          <div className="project-meta-item">
            <Icon name="calendar" size={18} />
            <div>
              <small>Срок проекта</small>
              <strong>{formatDate(project.start_date)} — {formatDate(project.due_date)}</strong>
            </div>
          </div>
          <div className="project-meta-item">
            <Icon name="team" size={18} />
            <div>
              <small>Участники</small>
              <strong>{project.members_count} человек</strong>
            </div>
          </div>
          <div className="project-meta-item project-meta-progress">
            <div>
              <small>Прогресс · {project.done_tasks} из {project.total_tasks}</small>
              <ProgressBar value={progress} label={`${progress}%`} />
            </div>
          </div>
        </div>

        {project.status === "archived" ? (
          <div className="notice notice-muted">
            <Icon name="archive" size={17} />
            Проект находится в архиве. Данные доступны только для просмотра.
          </div>
        ) : null}
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${tab === item.id ? "active" : ""}`}
            onClick={() => changeTab(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
            {item.id === "members" ? <span className="tab-count">{members.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "board" ? (
        <KanbanBoard
          tasks={tasks}
          onOpen={openTask}
          onMove={moveTask}
          canDrag={canMoveTask}
          onAddTask={
            canCreate && project.status !== "archived"
              ? (status) => {
                  setCreateStatus(status);
                  setCreateOpen(true);
                }
              : null
          }
          addLabel="Задачу"
        />
      ) : null}

      {tab === "list" ? (
        <div className="page-stack">
          <div className="filters-bar card">
            <div className="filter-search">
              <Icon name="search" size={17} />
              <input
                type="search"
                placeholder="Поиск по названию или номеру"
                value={listFilters.search}
                onChange={(event) => setListFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <select
              value={listFilters.status}
              onChange={(event) => setListFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Все статусы</option>
              {STATUSES.map((status) => (
                <option key={status.id} value={status.id}>{status.label}</option>
              ))}
            </select>
            <select
              value={listFilters.assignee}
              onChange={(event) => setListFilters((prev) => ({ ...prev, assignee: event.target.value }))}
            >
              <option value="">Все исполнители</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
              ))}
            </select>
            <span className="filter-count">Найдено: {filteredTasks.length}</span>
          </div>

          {filteredTasks.length ? (
            <div className="card table-card">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Исполнитель</th>
                    <th>Статус</th>
                    <th>Приоритет</th>
                    <th>Срок</th>
                    <th>Постановщик</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const due = dueMeta(task);
                    return (
                      <tr
                        key={task.id}
                        className={isTaskOverdue(task) ? "row-overdue" : ""}
                        onClick={() => openTask(task.id)}
                      >
                        <td data-label="Задача">
                          <div className="table-task">
                            <span className="task-code">{task.code}</span>
                            <strong>{task.title}</strong>
                          </div>
                        </td>
                        <td data-label="Исполнитель">
                          {task.assignee_name ? (
                            <span className="table-user">
                              <Avatar name={task.assignee_name} src={task.assignee_avatar} size={26} />
                              {task.assignee_name}
                            </span>
                          ) : (
                            <span className="muted">Не назначен</span>
                          )}
                        </td>
                        <td data-label="Статус">
                          {canMoveTask(task) ? (
                            <select
                              className={`mini-select status-select-${task.status}`}
                              value={task.status}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => quickStatus(task, event.target.value)}
                            >
                              {STATUSES.map((status) => (
                                <option key={status.id} value={status.id}>{status.label}</option>
                              ))}
                            </select>
                          ) : (
                            <StatusBadge status={task.status} />
                          )}
                        </td>
                        <td data-label="Приоритет"><PriorityBadge priority={task.priority} /></td>
                        <td data-label="Срок"><span className={`tone-${due.tone}`}>{due.text}</span></td>
                        <td data-label="Постановщик"><span className="table-muted">{task.reporter_name}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card">
              <EmptyState icon="tasks" title="Задач не найдено" text="Измените фильтры или создайте первую задачу." />
            </div>
          )}
        </div>
      ) : null}

      {tab === "members" ? (
        <div className="page-stack">
          <div className="section-toolbar">
            <div>
              <h2>Участники проекта</h2>
              <p className="muted">{members.length} человек в команде</p>
            </div>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setAddMemberOpen(true)}>
                <Icon name="plus" size={16} />
                Добавить участника
              </button>
            ) : null}
          </div>

          <div className="member-grid">
            {members.map((member) => (
              <div key={member.id} className="member-card card">
                <div className="member-card-head">
                  <Avatar user={member} size={46} />
                  <div className="member-card-name">
                    <strong>{member.first_name} {member.last_name}</strong>
                    <span>{member.position || "Сотрудник"}</span>
                  </div>
                  {member.is_manager ? (
                    <span className="badge badge-manager">Руководитель</span>
                  ) : null}
                </div>
                <a href={`mailto:${member.email}`} className="member-email">{member.email}</a>
                <div className="member-stats">
                  <div><strong>{member.active_tasks}</strong><span>активных</span></div>
                  <div className={member.overdue_tasks ? "danger-text" : ""}><strong>{member.overdue_tasks}</strong><span>просрочено</span></div>
                  <div><strong>{member.done_tasks}</strong><span>выполнено</span></div>
                </div>
                <div className="member-card-foot">
                  {canManage && !member.is_manager ? (
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={member.can_create_tasks}
                        onChange={() => toggleCanCreate(member)}
                      />
                      <span className="switch" />
                      <span>Создаёт задачи</span>
                    </label>
                  ) : (
                    <span className="muted-small">
                      {member.can_create_tasks ? "Может создавать задачи" : "Только исполнитель"}
                    </span>
                  )}
                  {canManage && !member.is_manager ? (
                    <button
                      type="button"
                      className="icon-btn icon-btn-ghost danger-text"
                      onClick={() => removeMember(member)}
                      title="Удалить из проекта"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "info" ? (
        <div className="info-grid">
          <section className="card info-card">
            <h2>Описание проекта</h2>
            <p className="info-description">{project.description || "Описание не заполнено."}</p>

            <div className="info-rows">
              <div><span>Руководитель</span><strong>{project.manager_name}</strong></div>
              <div><span>Статус</span><ProjectStatusBadge status={project.status} /></div>
              <div><span>Дата старта</span><strong>{formatDate(project.start_date)}</strong></div>
              <div><span>Плановая дата завершения</span><strong>{formatDate(project.due_date)}</strong></div>
              <div><span>Создан</span><strong>{formatDateTime(project.created_at)}</strong></div>
              <div><span>Участников</span><strong>{members.length}</strong></div>
            </div>
          </section>

          <section className="card info-card">
            <h2>Распределение задач</h2>
            <div className="info-status-list">
              {STATUSES.map((status) => {
                const count = Number(detail.stats.by_status[status.id] || 0);
                const percent = project.total_tasks
                  ? Math.round((count / project.total_tasks) * 100)
                  : 0;
                return (
                  <div key={status.id} className="info-status-row">
                    <div className="info-status-label">
                      <span className={`legend-dot dist-${status.id}`} />
                      {STATUS_MAP[status.id]?.label}
                    </div>
                    <div className="info-status-bar">
                      <span className={`dist-${status.id}`} style={{ width: `${percent}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>

            <h3 className="info-subhead">Приоритеты</h3>
            <div className="info-priority-list">
              {PRIORITIES.map((priority) => (
                <div key={priority.id} className="info-priority">
                  <PriorityBadge priority={priority.id} />
                  <strong>{Number(detail.stats.by_priority[priority.id] || 0)}</strong>
                </div>
              ))}
            </div>

            <div className="info-progress-block">
              <div className="project-progress-head">
                <span>Общий прогресс</span>
                <strong>{progress}%</strong>
              </div>
              <ProgressBar value={progress} />
              <p className="muted-small">
                {project.done_tasks} из {project.total_tasks} задач выполнено. Открыто: {project.open_tasks}.
                {project.overdue_tasks ? ` Просрочено: ${project.overdue_tasks}.` : ""}
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {createOpen ? (
        <TaskFormModal
          projects={[project]}
          projectId={project.id}
          defaultStatus={createStatus}
          onClose={() => setCreateOpen(false)}
          onCreated={() => bump()}
        />
      ) : null}

      {editOpen ? (
        <ProjectFormModal
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => bump()}
        />
      ) : null}

      {addMemberOpen ? (
        <AddMemberModal
          project={{ ...project, members }}
          onClose={() => setAddMemberOpen(false)}
          onAdded={() => bump()}
        />
      ) : null}
    </div>
  );
}
