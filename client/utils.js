const MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, { year = true } = {}) {
  const date = parseDate(value);
  if (!date) return "—";
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return year ? `${base} ${date.getFullYear()}` : base;
}

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "—";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date, { year: false })}, ${hours}:${minutes}`;
}

export function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} ${plural(minutes, ["минуту", "минуты", "минут"])} назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, ["час", "часа", "часов"])} назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
  return formatDate(date);
}

export function plural(count, forms) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function dateDiffFromToday(value) {
  const date = parseDate(value);
  if (!date) return null;
  const today = parseDate(todayString());
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function isTaskOverdue(task) {
  if (!task?.due_date || task.status === "done") return false;
  return task.due_date < todayString();
}

export function dueMeta(task) {
  if (!task?.due_date) return { text: "Без срока", tone: "muted" };
  if (task.status === "done") return { text: formatDate(task.due_date), tone: "muted" };
  const diff = dateDiffFromToday(task.due_date);
  if (diff === null) return { text: "Без срока", tone: "muted" };
  if (diff < 0) {
    return {
      text: `Просрочено на ${Math.abs(diff)} ${plural(Math.abs(diff), ["день", "дня", "дней"])}`,
      tone: "danger",
    };
  }
  if (diff === 0) return { text: "Сегодня", tone: "warning" };
  if (diff === 1) return { text: "Завтра", tone: "warning" };
  if (diff <= 7) return { text: `Через ${diff} ${plural(diff, ["день", "дня", "дней"])}`, tone: "soon" };
  return { text: formatDate(task.due_date), tone: "normal" };
}

export function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function avatarTone(name) {
  let hash = 0;
  for (const char of String(name || "?")) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return (hash % 8) + 1;
}

export function fullName(user) {
  if (!user) return "";
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

export function loadState(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function sortByPriority(tasks) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    const byRank = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    if (byRank !== 0) return byRank;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}
