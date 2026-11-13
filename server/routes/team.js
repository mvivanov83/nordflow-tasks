import { Router } from "express";
import { get, query } from "../db.js";
import { requireAuth } from "../auth.js";
import { ah, dateOnly, httpError, publicUser } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  ah(async (req, res) => {
    const today = dateOnly();
    const users = await query(
      `SELECT u.id, u.first_name, u.last_name, u.position, u.email, u.avatar_url, u.role,
         (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status <> 'done') AS active_tasks,
         (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'done') AS done_tasks,
         (SELECT COUNT(*) FROM tasks t
           WHERE t.assignee_id = u.id AND t.status <> 'done'
             AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue_tasks,
         (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = u.id) AS projects_count
       FROM users u
       WHERE u.is_active = 1
       ORDER BY u.first_name, u.last_name`,
      [today],
    );
    res.json({
      users: users.map((user) => ({
        ...user,
        active_tasks: Number(user.active_tasks || 0),
        done_tasks: Number(user.done_tasks || 0),
        overdue_tasks: Number(user.overdue_tasks || 0),
        projects_count: Number(user.projects_count || 0),
      })),
    });
  }),
);

router.get(
  "/:id/tasks",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const canView =
      req.user.role === "admin" || req.user.role === "manager" || req.user.id === id;
    if (!canView) {
      throw httpError(403, "Задачи сотрудника доступны руководителю и администратору");
    }

    const user = await get("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) throw httpError(404, "Сотрудник не найден");

    const today = dateOnly();
    const tasks = await query(
      `SELECT t.id, t.code, t.title, t.status, t.priority, t.due_date, t.project_id,
         p.name AS project_name
       FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.assignee_id = ? AND t.status <> 'done'
       ORDER BY t.due_date IS NULL, t.due_date, t.priority`,
      [id],
    );

    res.json({
      user: publicUser(user),
      tasks: tasks.map((task) => ({
        ...task,
        is_overdue:
          Boolean(task.due_date) && task.due_date < today && task.status !== "done",
      })),
    });
  }),
);

export default router;
