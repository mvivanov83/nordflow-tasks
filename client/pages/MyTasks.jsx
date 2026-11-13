import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  EmptyState,
  PageLoader,
  PriorityBadge,
  StatusBadge,
} from "../ui.jsx";
import { PRIORITIES, STATUSES } from "../constants.js";
import KanbanBoard from "../components/KanbanBoard.jsx";
import TaskFormModal from "../components/TaskFormModal.jsx";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";
import {
  dueMeta,
  isTaskOverdue,
  loadState,
  saveState,
  sortByPriority,
  todayString,
} from "../utils.js";

function endOfWeekString() {
  const date = new Date();
  const day = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() + (7 - day));
  return todayStringFromDate(date);
}

function endOfMonthString() {
  const date = new Date();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return todayStringFromDate(end);
}

function todayStringFromDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function MyTasks() {
  const { version, bump, openTask } = useData();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState(() => loadState("nordflow_task_view", "list"));
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState("backlog");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    project: "",
    priority: "",
    due: "",
    overdue: false,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api("/tasks?scope=mine&limit=1000"), api("/projects")])
      .then(([taskData, projectData]) => {
        if (!active) return;
        setTasks(taskData.tasks);
        setProjects(projectData.projects);
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
  }, [version]);

  function changeView(next) {
    setView(next);
    saveState("nordflow_task_view", next);
  }

  function updateFilter(field, value) {
    setFilters((previous) => ({ ...previous, [field]: value }));
  }

  const filtered = useMemo(() => {
    const today = todayString();
    const weekEnd = endOfWeekString();
    const monthEnd = endOfMonthString();
    const search = filters.search.trim().toLowerCase();

    return sortByPriority(
      tasks.filter((task) => {
        if (search && !`${task.title} ${task.code}`.toLowerCase().includes(search)) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.project && String(task.project_id) !== String(filters.project)) return false;
        if (filters.priority && task.priority !== filters.priority) return false;
        if (filters.overdue && !isTaskOverdue(task)) return false;
        if (filters.due === "overdue" && !isTaskOverdue(task)) return false;
        if (filters.due === "today" && task.due_date !== today) return false;
        if (
          filters.due === "week" &&
          (!task.due_date || task.due_date < today || task.due_date > weekEnd)
        ) return false;
        if (
          filters.due === "month" &&
          (!task.due_date || task.due_date < today || task.due_date > monthEnd)
        ) return false;
        if (filters.due === "none" && task.due_date) return false;
        return true;
      }),
    );
  }, [tasks, filters]);

  const hasFilters =
    filters.search ||
    filters.status ||
    filters.project ||
    filters.priority ||
    filters.due ||
    filters.overdue;

  const canCreate = projects.some((project) => project.my_permissions?.can_create_tasks);
  const overdueCount = tasks.filter(isTaskOverdue).length;

  async function updateStatus(task, status) {
    if (task.status === status) return;
    const previous = tasks;
    setTasks((list) => list.map((item) => (item.id === task.id ? { ...item, status } : item)));
    try {
      await api(`/tasks/${task.id}/status`, { method: "PATCH", body: { status } });
      toast(`Статус задачи ${task.code} изменён`);
      bump();
    } catch (err) {
      setTasks(previous);
      toast(err.message, "error");
    }
  }

  function resetFilters() {
    setFilters({ search: "", status: "", project: "", priority: "", due: "", overdue: false });
  }

  function openCreate(status = "backlog") {
    setCreateStatus(status);
    setCreateOpen(true);
  }

  return (
    <div className="page-stack my-tasks-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Мои задачи</span>
          <h1>Задачи, назначенные на меня</h1>
          <p className="page-subtitle">
            {tasks.length} задач · {overdueCount ? <span className="danger-text">{overdueCount} просрочено</span> : "просрочек нет"}
          </p>
        </div>
        <div className="page-header-actions">
          <div className="view-switch" role="group" aria-label="Вид отображения">
            <button
              type="button"
              className={view === "list" ? "active" : ""}
              onClick={() => changeView("list")}
              title="Список"
            >
              <Icon name="list" size={17} />
              Список
            </button>
            <button
              type="button"
              className={view === "board" ? "active" : ""}
              onClick={() => changeView("board")}
              title="Доска по статусам"
            >
              <Icon name="grid" size={17} />
              Доска
            </button>
          </div>
          {canCreate ? (
            <button type="button" className="btn btn-cta" onClick={() => openCreate()}>
              <Icon name="plus" size={17} />
              Создать задачу
            </button>
          ) : null}
        </div>
      </div>

      <div className="filters-bar card">
        <div className="filter-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Поиск по названию или номеру"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>

        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">Все статусы</option>
          {STATUSES.map((status) => (
            <option key={status.id} value={status.id}>{status.label}</option>
          ))}
        </select>

        <select value={filters.project} onChange={(event) => updateFilter("project", event.target.value)}>
          <option value="">Все проекты</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>

        <select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
          <option value="">Все приоритеты</option>
          {PRIORITIES.map((priority) => (
            <option key={priority.id} value={priority.id}>{priority.label}</option>
          ))}
        </select>

        <select value={filters.due} onChange={(event) => updateFilter("due", event.target.value)}>
          <option value="">Любой срок</option>
          <option value="overdue">Просроченные</option>
          <option value="today">На сегодня</option>
          <option value="week">На этой неделе</option>
          <option value="month">В этом месяце</option>
          <option value="none">Без срока</option>
        </select>

        <label className="check check-inline">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(event) => updateFilter("overdue", event.target.checked)}
          />
          <span>Только просроченные</span>
        </label>

        {hasFilters ? (
          <button type="button" className="link-btn filter-reset" onClick={resetFilters}>
            Сбросить
          </button>
        ) : null}
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {loading && !tasks.length ? <PageLoader /> : null}

      {!loading && !filtered.length ? (
        <div className="card">
          <EmptyState
            icon="tasks"
            title={hasFilters ? "По фильтрам ничего не найдено" : "У вас пока нет задач"}
            text={
              hasFilters
                ? "Попробуйте изменить условия фильтрации."
                : "Когда руководитель назначит вам задачу, она появится здесь."
            }
            action={
              hasFilters ? (
                <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              ) : null
            }
          />
        </div>
      ) : null}

      {filtered.length && view === "board" ? (
        <KanbanBoard
          tasks={filtered}
          onOpen={openTask}
          onMove={updateStatus}
          canDrag={() => true}
          onAddTask={canCreate ? openCreate : null}
          addLabel="Задачу"
        />
      ) : null}

      {filtered.length && view === "list" ? (
        <div className="card table-card">
          <table className="task-table">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Проект</th>
                <th>Статус</th>
                <th>Приоритет</th>
                <th>Срок</th>
                <th>Постановщик</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const due = dueMeta(task);
                const overdue = isTaskOverdue(task);
                return (
                  <tr
                    key={task.id}
                    className={overdue ? "row-overdue" : ""}
                    onClick={() => openTask(task.id)}
                  >
                    <td data-label="Задача">
                      <div className="table-task">
                        <span className="task-code">{task.code}</span>
                        <strong>{task.title}</strong>
                        {task.tags?.length ? (
                          <span className="table-tags">
                            {task.tags.slice(0, 2).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Проект"><span className="table-muted">{task.project_name}</span></td>
                    <td data-label="Статус">
                      <select
                        className={`mini-select status-select-${task.status}`}
                        value={task.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateStatus(task, event.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Приоритет"><PriorityBadge priority={task.priority} /></td>
                    <td data-label="Срок">
                      <span className={`tone-${due.tone}`}>{due.text}</span>
                    </td>
                    <td data-label="Постановщик"><span className="table-muted">{task.reporter_name}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <TaskFormModal
          projects={projects}
          defaultStatus={createStatus}
          onClose={() => setCreateOpen(false)}
          onCreated={() => bump()}
        />
      ) : null}
    </div>
  );
}
