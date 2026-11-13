import { Router } from "express";
import {
  get,
  query,
  run,
  insert,
  getSetting,
  setSetting,
} from "../db.js";
import { requireAuth } from "../auth.js";
import {
  projectAccessWhere,
  requireProjectAccess,
  requireTaskAccess,
} from "../access.js";
import { notifySafe } from "../notify.js";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  addDays,
  ah,
  cleanString,
  dateOnly,
  endOfMonth,
  endOfWeek,
  fullName,
  httpError,
  isDueDate,
  nowIso,
  parseJsonArray,
  parseTags,
} from "../util.js";

const router = Router();
router.use(requireAuth);

const TASK_SELECT = `
  SELECT t.*,
    p.name AS project_name,
    p.status AS project_status,
    p.manager_id AS project_manager_id,
    a.first_name || ' ' || a.last_name AS assignee_name,
    a.avatar_url AS assignee_avatar,
    r.first_name || ' ' || r.last_name AS reporter_name,
    r.avatar_url AS reporter_avatar,
    (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) AS comments_count,
    (SELECT COUNT(*) FROM attachments att WHERE att.task_id = t.id) AS attachments_count
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a ON a.id = t.assignee_id
  JOIN users r ON r.id = t.reporter_id
`;

function mapTask(row) {
  if (!row) return null;
  const today = dateOnly();
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    comments_count: Number(row.comments_count || 0),
    attachments_count: Number(row.attachments_count || 0),
    is_overdue:
      Boolean(row.due_date) && row.due_date < today && row.status !== "done",
  };
}

export async function loadTask(id) {
  const task = mapTask(await get(`${TASK_SELECT} WHERE t.id = ?`, [id]));
  if (!task) return null;

  const comments = await query(
    `SELECT c.*, u.first_name || ' ' || u.last_name AS author_name,
       u.avatar_url AS author_avatar, u.position AS author_position
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC`,
    [id],
  );

  const history = await query(
    `SELECT h.*, u.first_name || ' ' || u.last_name AS actor_name,
       u.avatar_url AS actor_avatar
     FROM task_history h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.task_id = ?
     ORDER BY h.created_at DESC, h.id DESC`,
    [id],
  );

  const attachments = await query(
    `SELECT att.*, u.first_name || ' ' || u.last_name AS author_name
     FROM attachments att
     LEFT JOIN users u ON u.id = att.user_id
     WHERE att.task_id = ?
     ORDER BY att.created_at DESC`,
    [id],
  );

  return { ...task, comments, history, attachments };
}

async function generateTaskCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seq = Number(await getSetting("task_seq", "100")) + 1;
    await setSetting("task_seq", seq);
    const code = `NDF-${seq}`;
    const existing = await get("SELECT id FROM tasks WHERE code = ?", [code]);
    if (!existing) return code;
  }
  return `NDF-${Date.now()}`;
}

async function insertHistory(taskId, actorId, action, field = null, oldValue = null, newValue = null) {
  await run(
    `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [taskId, actorId, action, field, oldValue, newValue, nowIso()],
  );
}

async function activeUser(userId) {
  if (!userId) return null;
  return get("SELECT * FROM users WHERE id = ? AND is_active = 1", [userId]);
}

router.get(
  "/",
  ah(async (req, res) => {
    const access = projectAccessWhere(req.user, "p");
    const where = [access.sql];
    const params = [...access.params];
    const today = dateOnly();

    if (req.query.scope === "mine") {
      where.push("t.assignee_id = ?");
      params.push(req.user.id);
    }

    if (req.query.project_id) {
      where.push("t.project_id = ?");
      params.push(Number(req.query.project_id));
    }

    if (req.query.assignee_id) {
      where.push("t.assignee_id = ?");
      params.push(Number(req.query.assignee_id));
    }

    if (req.query.status && STATUSES.includes(String(req.query.status))) {
      where.push("t.status = ?");
      params.push(req.query.status);
    }

    if (req.query.priority && PRIORITIES.includes(String(req.query.priority))) {
      where.push("t.priority = ?");
      params.push(req.query.priority);
    }

    const search = cleanString(req.query.search, 160);
    if (search) {
      where.push("(LOWER(t.title) LIKE LOWER(?) OR LOWER(t.code) LIKE LOWER(?))");
      params.push(`%${search}%`, `%${search}%`);
    }

    const due = String(req.query.due || "");
    if (due === "overdue" || req.query.overdue === "1") {
      where.push("t.due_date IS NOT NULL AND t.due_date < ? AND t.status <> 'done'");
      params.push(today);
    } else if (due === "today") {
      where.push("t.due_date = ?");
      params.push(today);
    } else if (due === "week") {
      where.push("t.due_date BETWEEN ? AND ?");
      params.push(today, dateOnly(endOfWeek()));
    } else if (due === "month") {
      where.push("t.due_date BETWEEN ? AND ?");
      params.push(today, dateOnly(endOfMonth()));
    } else if (due === "none") {
      where.push("t.due_date IS NULL");
    }

    let order = `CASE t.priority
        WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.due_date IS NULL, t.due_date, t.created_at DESC`;
    if (req.query.sort === "due") {
      order = "t.due_date IS NULL, t.due_date, t.created_at DESC";
    } else if (req.query.sort === "created") {
      order = "t.created_at DESC";
    } else if (req.query.sort === "updated") {
      order = "t.updated_at DESC";
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);

    const rows = await query(
      `${TASK_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ${limit}`,
      params,
    );
    res.json({ tasks: rows.map(mapTask) });
  }),
);

router.post(
  "/",
  ah(async (req, res) => {
    const projectId = Number(req.body?.project_id);
    const access = await requireProjectAccess(req.user, projectId);
    if (!access.canCreateTasks) {
      throw httpError(403, "Создание задач в этом проекте не разрешено");
    }

    const title = cleanString(req.body?.title, 200);
    const description = cleanString(req.body?.description, 20000);
    const status = STATUSES.includes(req.body?.status) ? req.body.status : "backlog";
    const priority = PRIORITIES.includes(req.body?.priority) ? req.body.priority : "medium";
    const assigneeId = Number(req.body?.assignee_id);
    const dueDate = req.body?.due_date || null;
    const tags = parseTags(req.body?.tags);

    if (!title) throw httpError(400, "Название задачи обязательно");
    if (!assigneeId) throw httpError(400, "Выберите исполнителя");
    if (dueDate && !isDueDate(dueDate)) throw httpError(400, "Некорректный дедлайн");

    const assignee = await activeUser(assigneeId);
    if (!assignee) throw httpError(400, "Исполнитель не найден или отключён");

    const code = await generateTaskCode();
    const timestamp = nowIso();
    const completedAt = status === "done" ? timestamp : null;

    const id = await insert(
      `INSERT INTO tasks
        (code, project_id, title, description, status, priority, assignee_id, reporter_id,
         due_date, tags, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        projectId,
        title,
        description,
        status,
        priority,
        assigneeId,
        req.user.id,
        dueDate,
        JSON.stringify(tags),
        timestamp,
        timestamp,
        completedAt,
      ],
    );

    await insertHistory(id, req.user.id, "created", null, null, title);

    if (assigneeId !== req.user.id) {
      await notifySafe({
        userId: assigneeId,
        type: "assigned",
        title: `Вам назначена задача ${code}`,
        body: `«${title}» · проект «${access.project.name}»`,
        taskId: id,
        projectId,
      });
    }

    const task = await loadTask(id);
    res.status(201).json({ task });
  }),
);

router.get(
  "/:id",
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.id));
    const task = await loadTask(access.task.id);
    res.json({
      task,
      permissions: {
        can_edit: access.canEditTask,
        can_move: access.canMoveTask,
        can_manage_project: access.isAdmin || access.isManager,
      },
    });
  }),
);

async function applyTaskUpdate(req, access, forcedStatus = null) {
  const task = access.task;
  const updates = [];
  const params = [];
  const changes = [];
  const timestamp = nowIso();

  if (req.body?.title !== undefined) {
    const value = cleanString(req.body.title, 200);
    if (!value) throw httpError(400, "Название задачи обязательно");
    if (value !== task.title) {
      updates.push("title = ?");
      params.push(value);
      changes.push({ field: "title", old: task.title, new: value });
    }
  }

  if (req.body?.description !== undefined) {
    const value = cleanString(req.body.description, 20000);
    if (value !== task.description) {
      updates.push("description = ?");
      params.push(value);
      changes.push({
        field: "description",
        old: cleanString(task.description, 300),
        new: cleanString(value, 300),
      });
    }
  }

  if (req.body?.status !== undefined || forcedStatus) {
    const value = forcedStatus || req.body.status;
    if (!STATUSES.includes(value)) throw httpError(400, "Некорректный статус");
    if (value !== task.status) {
      updates.push("status = ?");
      params.push(value);
      updates.push("completed_at = ?");
      params.push(value === "done" ? timestamp : null);
      changes.push({
        field: "status",
        old: STATUS_LABELS[task.status] || task.status,
        new: STATUS_LABELS[value] || value,
      });
    }
  }

  if (req.body?.priority !== undefined) {
    const value = req.body.priority;
    if (!PRIORITIES.includes(value)) throw httpError(400, "Некорректный приоритет");
    if (value !== task.priority) {
      updates.push("priority = ?");
      params.push(value);
      changes.push({
        field: "priority",
        old: PRIORITY_LABELS[task.priority] || task.priority,
        new: PRIORITY_LABELS[value] || value,
      });
    }
  }

  if (req.body?.assignee_id !== undefined) {
    const value = Number(req.body.assignee_id);
    const assignee = await activeUser(value);
    if (!assignee) throw httpError(400, "Исполнитель не найден или отключён");
    if (value !== task.assignee_id) {
      updates.push("assignee_id = ?");
      params.push(value);
      const oldUser = task.assignee_id
        ? await get("SELECT * FROM users WHERE id = ?", [task.assignee_id])
        : null;
      changes.push({
        field: "assignee",
        old: fullName(oldUser) || "Не назначен",
        new: fullName(assignee),
      });
    }
  }

  if (req.body?.due_date !== undefined && !forcedStatus) {
    const value = req.body.due_date || null;
    if (value && !isDueDate(value)) throw httpError(400, "Некорректный дедлайн");
    if (value !== task.due_date) {
      updates.push("due_date = ?");
      params.push(value);
      changes.push({
        field: "due_date",
        old: task.due_date || "Без срока",
        new: value || "Без срока",
      });
    }
  }

  if (req.body?.tags !== undefined && !forcedStatus) {
    const tags = parseTags(req.body.tags);
    updates.push("tags = ?");
    params.push(JSON.stringify(tags));
  }

  if (!updates.length) return { changed: false };

  updates.push("updated_at = ?");
  params.push(timestamp, task.id);
  await run(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`, params);

  for (const change of changes) {
    await insertHistory(task.id, req.user.id, "updated", change.field, change.old, change.new);
  }

  const statusChange = changes.find((c) => c.field === "status");
  const dueChange = changes.find((c) => c.field === "due_date");
  const assigneeChange = changes.find((c) => c.field === "assignee");
  const updated = await get("SELECT * FROM tasks WHERE id = ?", [task.id]);
  const notifyUsers = new Set();

  if (assigneeChange && updated.assignee_id && updated.assignee_id !== req.user.id) {
    notifyUsers.add(updated.assignee_id);
    await notifySafe({
      userId: updated.assignee_id,
      type: "assigned",
      title: `Вам назначена задача ${task.code}`,
      body: `«${updated.title}»`,
      taskId: task.id,
      projectId: task.project_id,
    });
  }

  if (dueChange && updated.assignee_id && updated.assignee_id !== req.user.id) {
    await notifySafe({
      userId: updated.assignee_id,
      type: "due_changed",
      title: `Изменён срок задачи ${task.code}`,
      body: `Новый срок: ${updated.due_date || "без срока"}.`,
      taskId: task.id,
      projectId: task.project_id,
    });
  }

  if (statusChange) {
    const targets = [updated.assignee_id, updated.reporter_id].filter(
      (id) => id && id !== req.user.id,
    );
    for (const target of new Set(targets)) {
      await notifySafe({
        userId: target,
        type: "status_changed",
        title: `Статус задачи ${task.code} изменён`,
        body: `Новый статус: ${STATUS_LABELS[updated.status] || updated.status}.`,
        taskId: task.id,
        projectId: task.project_id,
      });
    }
  }

  return { changed: true };
}

router.patch(
  "/:id/status",
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.id));
    if (!access.canMoveTask) {
      throw httpError(403, "Менять статус может исполнитель, руководитель проекта или администратор");
    }
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw httpError(400, "Некорректный статус");
    await applyTaskUpdate(req, access, status);
    const task = await loadTask(access.task.id);
    res.json({ task });
  }),
);

router.patch(
  "/:id",
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.id));
    if (!access.canEditTask) {
      throw httpError(403, "Редактировать задачу может руководитель проекта, автор задачи или администратор");
    }
    await applyTaskUpdate(req, access);
    const task = await loadTask(access.task.id);
    res.json({ task });
  }),
);

export default router;
