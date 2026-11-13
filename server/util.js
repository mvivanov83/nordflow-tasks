export const STATUSES = ["backlog", "planned", "in_progress", "review", "done"];
export const PRIORITIES = ["low", "medium", "high", "critical"];
export const PROJECT_STATUSES = ["planning", "active", "paused", "completed", "archived"];
export const ROLES = ["admin", "manager", "employee"];

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function ah(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function nowIso() {
  return new Date().toISOString();
}

export function dateOnly(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function endOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  return addDays(d, 7 - day);
}

export function endOfMonth(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function isDueDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseTags(value) {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function publicUser(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

export function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function cleanString(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export function fullName(user) {
  if (!user) return "";
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
}

export const STATUS_LABELS = {
  backlog: "Бэклог",
  planned: "Запланировано",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнено",
};

export const PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

export const PROJECT_STATUS_LABELS = {
  planning: "Планируется",
  active: "Активный",
  paused: "Приостановлен",
  completed: "Завершён",
  archived: "Архивный",
};

export const ROLE_LABELS = {
  admin: "Администратор",
  manager: "Руководитель проекта",
  employee: "Сотрудник",
};

export function statusLabel(value) {
  return STATUS_LABELS[value] || value || "";
}

export function priorityLabel(value) {
  return PRIORITY_LABELS[value] || value || "";
}

export function projectStatusLabel(value) {
  return PROJECT_STATUS_LABELS[value] || value || "";
}

export function roleLabel(value) {
  return ROLE_LABELS[value] || value || "";
}
