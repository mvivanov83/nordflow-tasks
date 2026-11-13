import { Router } from "express";
import { get, query, run, insert } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { projectAccessWhere, requireProjectAccess } from "../access.js";
import { notifySafe } from "../notify.js";
import {
  PROJECT_STATUSES,
  ah,
  cleanString,
  dateOnly,
  httpError,
  isDueDate,
  nowIso,
  publicUser,
} from "../util.js";

const router = Router();
router.use(requireAuth);

const PROJECT_SELECT = `
  SELECT p.*,
    u.first_name || ' ' || u.last_name AS manager_name,
    u.avatar_url AS manager_avatar,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done') AS open_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks,
    (SELECT COUNT(*) FROM tasks t
      WHERE t.project_id = p.id AND t.status <> 'done'
        AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue_tasks,
    (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS members_count
  FROM projects p
  JOIN users u ON u.id = p.manager_id
`;

function normalizeProject(row) {
  if (!row) return null;
  return {
    ...row,
    open_tasks: Number(row.open_tasks || 0),
    total_tasks: Number(row.total_tasks || 0),
    done_tasks: Number(row.done_tasks || 0),
    overdue_tasks: Number(row.overdue_tasks || 0),
    members_count: Number(row.members_count || 0),
  };
}

async function loadProjectDetail(id, user) {
  const access = await requireProjectAccess(user, id);
  const project = normalizeProject(
    await get(`${PROJECT_SELECT} WHERE p.id = ?`, [dateOnly(), id]),
  );
  if (!project) throw httpError(404, "Проект не найден");

  const members = await query(
    `SELECT u.id, u.first_name, u.last_name, u.position, u.email, u.avatar_url, u.role,
       pm.can_create_tasks, pm.added_at,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.project_id = pm.project_id AND t.assignee_id = u.id AND t.status <> 'done') AS active_tasks,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.project_id = pm.project_id AND t.assignee_id = u.id AND t.status <> 'done'
           AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue_tasks,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.project_id = pm.project_id AND t.assignee_id = u.id AND t.status = 'done') AS done_tasks
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.first_name, u.last_name`,
    [dateOnly(), id, project.manager_id],
  );

  const mapped = members.map((member) => ({
    ...member,
    active_tasks: Number(member.active_tasks || 0),
    overdue_tasks: Number(member.overdue_tasks || 0),
    done_tasks: Number(member.done_tasks || 0),
    can_create_tasks: Boolean(member.can_create_tasks),
    is_manager: member.id === project.manager_id,
  }));

  if (!mapped.some((m) => m.id === project.manager_id)) {
    const manager = await get(
      "SELECT id, first_name, last_name, position, email, avatar_url, role FROM users WHERE id = ?",
      [project.manager_id],
    );
    if (manager) {
      mapped.unshift({
        ...manager,
        can_create_tasks: true,
        is_manager: true,
        active_tasks: 0,
        overdue_tasks: 0,
        done_tasks: 0,
      });
    }
  }

  const statusRows = await query(
    "SELECT status, COUNT(*) AS c FROM tasks WHERE project_id = ? GROUP BY status",
    [id],
  );
  const priorityRows = await query(
    "SELECT priority, COUNT(*) AS c FROM tasks WHERE project_id = ? GROUP BY priority",
    [id],
  );

  const byStatus = {};
  for (const row of statusRows) byStatus[row.status] = Number(row.c);
  const byPriority = {};
  for (const row of priorityRows) byPriority[row.priority] = Number(row.c);

  return {
    project: {
      ...project,
      members_count: mapped.length,
      my_permissions: {
        can_manage: access.isAdmin || access.isManager,
        can_create_tasks: access.canCreateTasks,
        is_manager: access.isManager,
        is_admin: access.isAdmin,
      },
    },
    members: mapped,
    stats: { by_status: byStatus, by_priority: byPriority },
  };
}

router.get(
  "/",
  ah(async (req, res) => {
    const access = projectAccessWhere(req.user, "p");
    const params = [dateOnly(), ...access.params];
    let statusSql = "";
    if (req.query.status && PROJECT_STATUSES.includes(String(req.query.status))) {
      statusSql = "AND p.status = ?";
      params.push(req.query.status);
    }
    const rows = await query(
      `${PROJECT_SELECT}
       WHERE ${access.sql} ${statusSql}
       ORDER BY CASE p.status
         WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'paused' THEN 2
         WHEN 'completed' THEN 3 ELSE 4 END,
         p.due_date IS NULL, p.due_date, p.created_at DESC`,
      params,
    );

    const grants = {};
    if (req.user.role !== "admin") {
      const memberRows = await query(
        "SELECT project_id, can_create_tasks FROM project_members WHERE user_id = ?",
        [req.user.id],
      );
      for (const row of memberRows) grants[row.project_id] = Boolean(row.can_create_tasks);
    }

    res.json({
      projects: rows.map((row) => {
        const project = normalizeProject(row);
        const isManager = row.manager_id === req.user.id;
        return {
          ...project,
          my_permissions: {
            can_manage: req.user.role === "admin" || isManager,
            can_create_tasks:
              req.user.role === "admin" || isManager || Boolean(grants[row.id]),
            is_manager: isManager,
            is_admin: req.user.role === "admin",
          },
        };
      }),
    });
  }),
);

router.post(
  "/",
  requireAdmin,
  ah(async (req, res) => {
    const name = cleanString(req.body?.name, 160);
    const description = cleanString(req.body?.description, 5000);
    const managerId = Number(req.body?.manager_id);
    const startDate = req.body?.start_date || null;
    const dueDate = req.body?.due_date || null;
    const status = PROJECT_STATUSES.includes(req.body?.status) && req.body.status !== "archived"
      ? req.body.status
      : "planning";

    if (!name) throw httpError(400, "Название проекта обязательно");
    if (!managerId) throw httpError(400, "Выберите руководителя проекта");
    if (startDate && !isDueDate(startDate)) throw httpError(400, "Некорректная дата начала");
    if (dueDate && !isDueDate(dueDate)) throw httpError(400, "Некорректная дата завершения");
    if (startDate && dueDate && startDate > dueDate) {
      throw httpError(400, "Дата завершения не может быть раньше даты начала");
    }

    const manager = await get("SELECT * FROM users WHERE id = ? AND is_active = 1", [managerId]);
    if (!manager) throw httpError(400, "Руководитель не найден или отключён");

    const timestamp = nowIso();
    const id = await insert(
      `INSERT INTO projects
        (name, description, manager_id, start_date, due_date, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, managerId, startDate, dueDate, status, req.user.id, timestamp, timestamp],
    );

    const memberIds = new Set([managerId]);
    const rawMembers = Array.isArray(req.body?.members) ? req.body.members : [];
    for (const entry of rawMembers) {
      const memberId = Number(typeof entry === "object" ? entry.user_id : entry);
      if (memberId && memberId !== managerId) memberIds.add(memberId);
    }

    for (const memberId of memberIds) {
      const member = await get("SELECT id FROM users WHERE id = ? AND is_active = 1", [memberId]);
      if (!member) continue;
      const canCreate = memberId === managerId
        ? 1
        : rawMembers.some((entry) => {
            if (typeof entry === "object") {
              return Number(entry.user_id) === memberId && Boolean(entry.can_create_tasks);
            }
            return Number(entry) === memberId;
          })
          ? 1
          : 0;
      await run(
        "INSERT INTO project_members (project_id, user_id, can_create_tasks, added_at) VALUES (?, ?, ?, ?)",
        [id, memberId, canCreate, timestamp],
      );
      if (memberId !== req.user.id) {
        await notifySafe({
          userId: memberId,
          type: "project_added",
          title: "Вы добавлены в проект",
          body: `Проект «${name}».`,
          projectId: id,
        });
      }
    }

    const detail = await loadProjectDetail(id, req.user);
    res.status(201).json(detail);
  }),
);

router.get(
  "/:id",
  ah(async (req, res) => {
    const detail = await loadProjectDetail(Number(req.params.id), req.user);
    res.json(detail);
  }),
);

router.patch(
  "/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const access = await requireProjectAccess(req.user, id);
    if (!access.isAdmin && !access.isManager) {
      throw httpError(403, "Редактировать проект может администратор или руководитель проекта");
    }

    const updates = [];
    const params = [];

    if (req.body?.name !== undefined) {
      const name = cleanString(req.body.name, 160);
      if (!name) throw httpError(400, "Название проекта обязательно");
      updates.push("name = ?");
      params.push(name);
    }
    if (req.body?.description !== undefined) {
      updates.push("description = ?");
      params.push(cleanString(req.body.description, 5000));
    }
    if (req.body?.start_date !== undefined) {
      const value = req.body.start_date || null;
      if (value && !isDueDate(value)) throw httpError(400, "Некорректная дата начала");
      updates.push("start_date = ?");
      params.push(value);
    }
    if (req.body?.due_date !== undefined) {
      const value = req.body.due_date || null;
      if (value && !isDueDate(value)) throw httpError(400, "Некорректная дата завершения");
      updates.push("due_date = ?");
      params.push(value);
    }
    if (req.body?.status !== undefined) {
      if (!PROJECT_STATUSES.includes(req.body.status)) throw httpError(400, "Некорректный статус");
      if (req.body.status === "archived" && !access.isAdmin) {
        throw httpError(403, "Архивировать проект может только администратор");
      }
      updates.push("status = ?");
      params.push(req.body.status);
    }

    if (req.body?.manager_id !== undefined) {
      if (!access.isAdmin) throw httpError(403, "Сменить руководителя может только администратор");
      const managerId = Number(req.body.manager_id);
      const manager = await get("SELECT * FROM users WHERE id = ? AND is_active = 1", [managerId]);
      if (!manager) throw httpError(400, "Руководитель не найден");
      updates.push("manager_id = ?");
      params.push(managerId);
      await run(
        "INSERT INTO project_members (project_id, user_id, can_create_tasks, added_at) VALUES (?, ?, 1, ?)",
        [id, managerId, nowIso()],
      ).catch(() => {});
      await notifySafe({
        userId: managerId,
        type: "project_added",
        title: "Вы назначены руководителем проекта",
        body: `Проект «${cleanString(req.body?.name || access.project.name, 160)}».`,
        projectId: id,
      });
    }

    if (!updates.length) throw httpError(400, "Нет данных для изменения");

    updates.push("updated_at = ?");
    params.push(nowIso(), id);
    await run(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, params);

    const detail = await loadProjectDetail(id, req.user);
    res.json(detail);
  }),
);

router.post(
  "/:id/archive",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const project = await get("SELECT * FROM projects WHERE id = ?", [id]);
    if (!project) throw httpError(404, "Проект не найден");
    await run("UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ?", [
      nowIso(),
      id,
    ]);
    const detail = await loadProjectDetail(id, req.user);
    res.json(detail);
  }),
);

router.post(
  "/:id/members",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const access = await requireProjectAccess(req.user, id);
    if (!access.isAdmin && !access.isManager) {
      throw httpError(403, "Добавлять участников может администратор или руководитель проекта");
    }
    const userId = Number(req.body?.user_id);
    const canCreate = Boolean(req.body?.can_create_tasks);
    const user = await get("SELECT * FROM users WHERE id = ? AND is_active = 1", [userId]);
    if (!user) throw httpError(400, "Сотрудник не найден или отключён");

    const existing = await get(
      "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing) {
      await run(
        "UPDATE project_members SET can_create_tasks = ? WHERE project_id = ? AND user_id = ?",
        [canCreate ? 1 : 0, id, userId],
      );
    } else {
      await run(
        "INSERT INTO project_members (project_id, user_id, can_create_tasks, added_at) VALUES (?, ?, ?, ?)",
        [id, userId, canCreate ? 1 : 0, nowIso()],
      );
      await notifySafe({
        userId,
        type: "project_added",
        title: "Вы добавлены в проект",
        body: `Проект «${access.project.name}».`,
        projectId: id,
      });
    }

    const detail = await loadProjectDetail(id, req.user);
    res.json(detail);
  }),
);

router.patch(
  "/:id/members/:userId",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const access = await requireProjectAccess(req.user, id);
    if (!access.isAdmin && !access.isManager) {
      throw httpError(403, "Изменять права участника может администратор или руководитель проекта");
    }
    if (Number(req.params.userId) === access.project.manager_id) {
      throw httpError(400, "Руководитель проекта всегда может создавать задачи");
    }
    await run(
      "UPDATE project_members SET can_create_tasks = ? WHERE project_id = ? AND user_id = ?",
      [req.body?.can_create_tasks ? 1 : 0, id, Number(req.params.userId)],
    );
    const detail = await loadProjectDetail(id, req.user);
    res.json(detail);
  }),
);

router.delete(
  "/:id/members/:userId",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const access = await requireProjectAccess(req.user, id);
    if (!access.isAdmin && !access.isManager) {
      throw httpError(403, "Удалять участников может администратор или руководитель проекта");
    }
    const userId = Number(req.params.userId);
    if (userId === access.project.manager_id) {
      throw httpError(400, "Нельзя удалить руководителя проекта из участников");
    }
    await run("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [id, userId]);
    const detail = await loadProjectDetail(id, req.user);
    res.json(detail);
  }),
);

export default router;
