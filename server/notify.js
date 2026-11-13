import { insert, get, query } from "./db.js";
import { addDays, dateOnly, nowIso } from "./util.js";

export async function notify({
  userId,
  type,
  title,
  body = "",
  taskId = null,
  projectId = null,
  dedupeKey = null,
}) {
  if (!userId) return null;
  if (dedupeKey) {
    const existing = await get(
      "SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?",
      [userId, dedupeKey],
    );
    if (existing) return null;
  }
  return insert(
    `INSERT INTO notifications
      (user_id, type, title, body, task_id, project_id, is_read, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [userId, type, title, body, taskId, projectId, dedupeKey, nowIso()],
  );
}

export async function notifySafe(payload) {
  try {
    return await notify(payload);
  } catch (error) {
    console.error("[notify]", error.message);
    return null;
  }
}

/**
 * Создаёт уведомления о приближающихся и просроченных дедлайнах.
 * Дедупликация не даёт повторять одно и то же уведомление по задаче.
 */
export async function sweepDeadlines() {
  try {
    const today = dateOnly();
    const soon = dateOnly(addDays(new Date(), 2));
    const tasks = await query(
      `SELECT t.id, t.code, t.title, t.due_date, t.assignee_id, t.project_id
       FROM tasks t
       WHERE t.status <> 'done'
         AND t.assignee_id IS NOT NULL
         AND t.due_date IS NOT NULL
         AND t.due_date <= ?
       ORDER BY t.due_date`,
      [soon],
    );

    let created = 0;
    for (const task of tasks) {
      if (task.due_date < today) {
        const id = await notifySafe({
          userId: task.assignee_id,
          type: "overdue",
          title: `Задача ${task.code} просрочена`,
          body: `«${task.title}» — срок истёк ${task.due_date}.`,
          taskId: task.id,
          projectId: task.project_id,
          dedupeKey: `overdue:${task.id}`,
        });
        if (id) created += 1;
      } else {
        const id = await notifySafe({
          userId: task.assignee_id,
          type: "due_soon",
          title: `Приближается дедлайн ${task.code}`,
          body: `«${task.title}» нужно завершить до ${task.due_date}.`,
          taskId: task.id,
          projectId: task.project_id,
          dedupeKey: `duesoon:${task.id}`,
        });
        if (id) created += 1;
      }
    }
    if (created) console.log(`[deadlines] создано уведомлений: ${created}`);
    return created;
  } catch (error) {
    console.error("[deadlines]", error.message);
    return 0;
  }
}
