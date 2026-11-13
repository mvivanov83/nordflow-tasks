export const STATUSES = [
  { id: "backlog", label: "Бэклог", short: "Бэклог" },
  { id: "planned", label: "Запланировано", short: "План" },
  { id: "in_progress", label: "В работе", short: "В работе" },
  { id: "review", label: "На проверке", short: "Проверка" },
  { id: "done", label: "Выполнено", short: "Готово" },
];

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export const PRIORITIES = [
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "critical", label: "Критический" },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));

export const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const PROJECT_STATUSES = [
  { id: "planning", label: "Планируется" },
  { id: "active", label: "Активный" },
  { id: "paused", label: "Приостановлен" },
  { id: "completed", label: "Завершён" },
  { id: "archived", label: "Архивный" },
];

export const PROJECT_STATUS_MAP = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.id, s]),
);

export const ROLES = [
  { id: "admin", label: "Администратор" },
  { id: "manager", label: "Руководитель проекта" },
  { id: "employee", label: "Сотрудник" },
];

export const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export const HISTORY_FIELD_LABELS = {
  title: "Название",
  description: "Описание",
  status: "Статус",
  priority: "Приоритет",
  assignee: "Исполнитель",
  due_date: "Дедлайн",
};

export const NOTIFICATION_ICONS = {
  assigned: "user",
  due_changed: "calendar",
  status_changed: "refresh",
  comment: "comment",
  due_soon: "clock",
  overdue: "alert",
  project_added: "folder",
};
