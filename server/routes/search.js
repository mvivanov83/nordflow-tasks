import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { projectAccessWhere } from "../access.js";
import { ah, cleanString } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  ah(async (req, res) => {
    const q = cleanString(req.query.q, 100);
    if (q.length < 2) {
      return res.json({ projects: [], tasks: [], users: [], query: q });
    }

    const like = `%${q}%`;
    const access = projectAccessWhere(req.user, "p");

    const projects = await query(
      `SELECT p.id, p.name, p.description, p.status, p.due_date,
         u.first_name || ' ' || u.last_name AS manager_name
       FROM projects p JOIN users u ON u.id = p.manager_id
       WHERE ${access.sql}
         AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?))
       ORDER BY p.name LIMIT 8`,
      [...access.params, like, like],
    );

    const tasks = await query(
      `SELECT t.id, t.code, t.title, t.status, t.priority, t.due_date, t.project_id,
         p.name AS project_name,
         a.first_name || ' ' || a.last_name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users a ON a.id = t.assignee_id
       WHERE ${access.sql}
         AND (LOWER(t.title) LIKE LOWER(?) OR LOWER(t.code) LIKE LOWER(?))
       ORDER BY t.updated_at DESC LIMIT 10`,
      [...access.params, like, like],
    );

    const users = await query(
      `SELECT id, first_name, last_name, position, email, avatar_url, role
       FROM users
       WHERE is_active = 1
         AND (LOWER(first_name) LIKE LOWER(?) OR LOWER(last_name) LIKE LOWER(?)
              OR LOWER(first_name || ' ' || last_name) LIKE LOWER(?)
              OR LOWER(email) LIKE LOWER(?) OR LOWER(position) LIKE LOWER(?))
       ORDER BY first_name LIMIT 8`,
      [like, like, like, like, like],
    );

    res.json({ projects, tasks, users, query: q });
  }),
);

export default router;
