import { Router } from "express";
import { get, run, insert } from "../db.js";
import { requireAuth } from "../auth.js";
import { requireTaskAccess } from "../access.js";
import { attachmentUpload, removeLocalUpload } from "../uploads.js";
import { ah, cleanString, httpError, nowIso } from "../util.js";

const router = Router();
router.use(requireAuth);

function normalizeUrl(value) {
  let url = cleanString(value, 2000);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function history(taskId, userId, action, value) {
  await run(
    `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    [taskId, userId, action, value, nowIso()],
  );
}

router.post(
  "/tasks/:taskId/attachments/link",
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.taskId));
    const url = normalizeUrl(req.body?.url);
    if (!url) throw httpError(400, "Укажите корректную ссылку (http или https)");
    const name = cleanString(req.body?.name, 200) || url;

    const id = await insert(
      `INSERT INTO attachments (task_id, user_id, kind, name, url, mime, size, created_at)
       VALUES (?, ?, 'link', ?, ?, NULL, NULL, ?)`,
      [access.task.id, req.user.id, name, url, nowIso()],
    );
    await history(access.task.id, req.user.id, "attachment_added", name);

    const attachment = await get(
      `SELECT att.*, u.first_name || ' ' || u.last_name AS author_name
       FROM attachments att LEFT JOIN users u ON u.id = att.user_id WHERE att.id = ?`,
      [id],
    );
    res.status(201).json({ attachment });
  }),
);

router.post(
  "/tasks/:taskId/attachments/file",
  attachmentUpload.single("file"),
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.taskId));
    if (!req.file) throw httpError(400, "Файл не загружен");

    const url = `/uploads/attachments/${req.file.filename}`;
    const name = cleanString(req.file.originalname, 240) || req.file.filename;
    const id = await insert(
      `INSERT INTO attachments (task_id, user_id, kind, name, url, mime, size, created_at)
       VALUES (?, ?, 'file', ?, ?, ?, ?, ?)`,
      [access.task.id, req.user.id, name, url, req.file.mimetype, req.file.size, nowIso()],
    );
    await history(access.task.id, req.user.id, "attachment_added", name);

    const attachment = await get(
      `SELECT att.*, u.first_name || ' ' || u.last_name AS author_name
       FROM attachments att LEFT JOIN users u ON u.id = att.user_id WHERE att.id = ?`,
      [id],
    );
    res.status(201).json({ attachment });
  }),
);

router.delete(
  "/attachments/:id",
  ah(async (req, res) => {
    const attachment = await get("SELECT * FROM attachments WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (!attachment) throw httpError(404, "Вложение не найдено");
    const access = await requireTaskAccess(req.user, attachment.task_id);
    const canDelete =
      access.isAdmin || access.isManager || attachment.user_id === req.user.id;
    if (!canDelete) {
      throw httpError(403, "Удалить вложение может автор, руководитель проекта или администратор");
    }

    await run("DELETE FROM attachments WHERE id = ?", [attachment.id]);
    removeLocalUpload(attachment.url);
    await history(attachment.task_id, req.user.id, "attachment_removed", attachment.name);
    res.json({ ok: true });
  }),
);

export default router;
