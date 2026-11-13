import { Router } from "express";
import bcrypt from "bcryptjs";
import { get, query, run, insert } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import {
  ROLES,
  ah,
  cleanString,
  httpError,
  isEmail,
  nowIso,
  publicUser,
} from "../util.js";

const router = Router();
router.use(requireAuth);

const PUBLIC_FIELDS =
  "id, email, first_name, last_name, position, role, avatar_url, theme, is_active, created_at";

async function activeAdminCount() {
  const row = await get("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1");
  return Number(row?.c || 0);
}

router.get(
  "/",
  ah(async (req, res) => {
    const isAdmin = req.user.role === "admin";
    const includeInactive = isAdmin && req.query.include_inactive === "1";
    const rows = await query(
      `SELECT ${PUBLIC_FIELDS} FROM users
       ${includeInactive ? "" : "WHERE is_active = 1"}
       ORDER BY first_name, last_name`,
    );
    res.json({ users: rows });
  }),
);

router.post(
  "/",
  requireAdmin,
  ah(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const first_name = cleanString(req.body?.first_name, 80);
    const last_name = cleanString(req.body?.last_name, 80);
    const position = cleanString(req.body?.position, 120);
    const role = ROLES.includes(req.body?.role) ? req.body.role : "employee";

    if (!isEmail(email)) throw httpError(400, "Укажите корректную электронную почту");
    if (password.length < 6) throw httpError(400, "Пароль должен содержать не менее 6 символов");
    if (!first_name || !last_name) throw httpError(400, "Имя и фамилия обязательны");

    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) throw httpError(409, "Пользователь с такой почтой уже существует");

    const hash = await bcrypt.hash(password, 10);
    const id = await insert(
      `INSERT INTO users
        (email, password_hash, first_name, last_name, position, role, avatar_url, theme, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'light', 1, ?)`,
      [email, hash, first_name, last_name, position, role, nowIso()],
    );

    const user = await get(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
    res.status(201).json({ user });
  }),
);

router.patch(
  "/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const target = await get("SELECT * FROM users WHERE id = ?", [id]);
    if (!target) throw httpError(404, "Пользователь не найден");

    const updates = [];
    const params = [];

    for (const field of ["first_name", "last_name", "position"]) {
      if (req.body?.[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(cleanString(req.body[field], 120));
      }
    }

    if (req.body?.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!isEmail(email)) throw httpError(400, "Некорректная электронная почта");
      const duplicate = await get("SELECT id FROM users WHERE email = ? AND id <> ?", [email, id]);
      if (duplicate) throw httpError(409, "Пользователь с такой почтой уже существует");
      updates.push("email = ?");
      params.push(email);
    }

    if (req.body?.role !== undefined) {
      if (!ROLES.includes(req.body.role)) throw httpError(400, "Некорректная роль");
      if (target.role === "admin" && req.body.role !== "admin") {
        const count = await activeAdminCount();
        if (count <= 1) throw httpError(400, "В системе должен остаться хотя бы один администратор");
      }
      updates.push("role = ?");
      params.push(req.body.role);
    }

    if (req.body?.is_active !== undefined) {
      const isActive = req.body.is_active ? 1 : 0;
      if (id === req.user.id && !isActive) {
        throw httpError(400, "Нельзя отключить собственную учётную запись");
      }
      if (target.role === "admin" && !isActive) {
        const count = await activeAdminCount();
        if (count <= 1) throw httpError(400, "В системе должен остаться хотя бы один администратор");
      }
      if (!isActive) {
        const managed = await get("SELECT COUNT(*) AS c FROM projects WHERE manager_id = ?", [id]);
        if (Number(managed?.c || 0) > 0) {
          throw httpError(400, "Сначала назначьте другого руководителя проектов этого сотрудника");
        }
      }
      updates.push("is_active = ?");
      params.push(isActive);
    }

    if (req.body?.password) {
      const password = String(req.body.password);
      if (password.length < 6) throw httpError(400, "Пароль должен содержать не менее 6 символов");
      updates.push("password_hash = ?");
      params.push(await bcrypt.hash(password, 10));
    }

    if (!updates.length) throw httpError(400, "Нет данных для изменения");

    params.push(id);
    await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    if (req.body?.is_active === 0 || req.body?.is_active === false) {
      await run("DELETE FROM project_members WHERE user_id = ?", [id]);
    }

    const user = await get(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
    res.json({ user });
  }),
);

router.delete(
  "/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw httpError(400, "Нельзя удалить собственную учётную запись");

    const target = await get("SELECT * FROM users WHERE id = ?", [id]);
    if (!target) throw httpError(404, "Пользователь не найден");

    if (target.role === "admin") {
      const count = await activeAdminCount();
      if (count <= 1) throw httpError(400, "В системе должен остаться хотя бы один администратор");
    }

    const managed = await get("SELECT COUNT(*) AS c FROM projects WHERE manager_id = ?", [id]);
    if (Number(managed?.c || 0) > 0) {
      throw httpError(400, "Сначала назначьте другого руководителя проектов этого сотрудника");
    }

    await run("DELETE FROM project_members WHERE user_id = ?", [id]);
    await run("UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?", [id]);
    await run("UPDATE users SET is_active = 0 WHERE id = ?", [id]);
    res.json({ ok: true });
  }),
);

export default router;
