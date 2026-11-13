import { Router } from "express";
import { get, query } from "../db.js";
import { requireAuth } from "../auth.js";
import { projectAccessWhere } from "../access.js";
import { addDays, dateOnly, endOfWeek, ah } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  ah(async (req, res) => {
    const userId = req.user.id;
    const today = dateOnly();
    const weekEnd = dateOnly(endOfWeek());
    const inTwoDays = dateOnly(addDays(new Date(), 2));

    const active = await get(
      "SELECT COUNT(*) AS c FROM tasks WHERE assignee_id = ? AND status <> 'done'",
      [userId],
    );
    const overdue = await get(
      `SELECT COUNT(*) AS c FROM tasks WHERE assignee_id = ? AND status <> 'done'
       AND due_date IS NOT NULL AND due_date < ?`,
      [userId, today],
    );
    const week = await get(
      `SELECT COUNT(*) AS c FROM tasks WHERE assignee_id = ? AND status <> 'done'
       AND due_date BETWEEN ? AND ?`,
      [userId, today, weekEnd],
    );
    const completedWeek = await get(
      `SELECT COUNT(*) AS c FROM tasks WHERE assignee_id = ? AND status = 'done'
       AND completed_at IS NOT NULL AND substr(completed_at, 1, 10) >= ?`,
      [dateOnly(addDays(new Date(), -7)), userId].reverse(),
    );

    const deadlines = await query(
      `SELECT t.id, t.code, t.title, t.status, t.priority, t.due_date, t.project_id,
         p.name AS project_name
       FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.assignee_id = ? AND t.status <> 'done' AND t.due_date IS NOT NULL
       ORDER BY t.due_date ASC LIMIT 6`,
      [userId],
    );

    const access = projectAccessWhere(req.user, "p");
    const recent = await query(
      `SELECT h.id, h.action, h.field, h.old_value, h.new_value, h.created_at, h.task_id,
         t.code AS task_code, t.title AS task_title, p.name AS project_name,
         u.first_name || ' ' || u.last_name AS actor_name, u.avatar_url AS actor_avatar
       FROM task_history h
       JOIN tasks t ON t.id = h.task_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = h.user_id
       WHERE ${access.sql}
       ORDER BY h.created_at DESC, h.id DESC
       LIMIT 10`,
      access.params,
    );

    const projects = await query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS manager_name,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done') AS open_tasks,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
         (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS members_count
       FROM projects p JOIN users u ON u.id = p.manager_id
       WHERE ${access.sql} AND p.status <> 'archived'
       ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END,
         p.due_date IS NULL, p.due_date
       LIMIT 8`,
      access.params,
    );

    let managerSummary = null;
    if (req.user.role === "admin" || req.user.role === "manager") {
      const managedWhere =
        req.user.role === "admin"
          ? "p.status <> 'archived'"
          : "p.manager_id = ?";
      const managedParams = req.user.role === "admin" ? [] : [userId];
      const managedProjects = await query(
        `SELECT p.id, p.name FROM projects p WHERE ${managedWhere}`,
        managedParams,
      );
      const ids = managedProjects.map((p) => p.id);

      const byStatus = {};
      let managedOverdue = 0;
      let managedActive = 0;
      let team = [];

      if (ids.length) {
        const placeholders = ids.map(() => "?").join(", ");
        const statusRows = await query(
          `SELECT status, COUNT(*) AS c FROM tasks
           WHERE project_id IN (${placeholders}) GROUP BY status`,
          ids,
        );
        for (const row of statusRows) byStatus[row.status] = Number(row.c);

        const overdueRow = await get(
          `SELECT COUNT(*) AS c FROM tasks
           WHERE project_id IN (${placeholders}) AND status <> 'done'
             AND due_date IS NOT NULL AND due_date < ?`,
          [...ids, today],
        );
        managedOverdue = Number(overdueRow?.c || 0);
        managedActive = Object.entries(byStatus)
          .filter(([status]) => status !== "done")
          .reduce((sum, [, count]) => sum + Number(count), 0);

        team = await query(
          `SELECT DISTINCT u.id, u.first_name, u.last_name, u.position, u.avatar_url,
             (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status <> 'done') AS active_tasks,
             (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status <> 'done'
                AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue_tasks
           FROM users u
           JOIN project_members pm ON pm.user_id = u.id
           WHERE u.is_active = 1 AND pm.project_id IN (${placeholders})
           ORDER BY active_tasks DESC, u.first_name
           LIMIT 6`,
          [today, ...ids],
        );
      }

      managerSummary = {
        projects_count: managedProjects.length,
        by_status: byStatus,
        active_tasks: managedActive,
        overdue_tasks: managedOverdue,
        team: team.map((member) => ({
          ...member,
          active_tasks: Number(member.active_tasks || 0),
          overdue_tasks: Number(member.overdue_tasks || 0),
        })),
      };
    }

    res.json({
      stats: {
        active: Number(active?.c || 0),
        overdue: Number(overdue?.c || 0),
        week: Number(week?.c || 0),
        completed_week: Number(completedWeek?.c || 0),
      },
      upcoming_deadlines: deadlines,
      recent_updates: recent,
      my_projects: projects.map((project) => ({
        ...project,
        open_tasks: Number(project.open_tasks || 0),
        done_tasks: Number(project.done_tasks || 0),
        total_tasks: Number(project.total_tasks || 0),
        members_count: Number(project.members_count || 0),
      })),
      manager_summary: managerSummary,
      today,
      week_end: weekEnd,
      soon: inTwoDays,
    });
  }),
);

export default router;
