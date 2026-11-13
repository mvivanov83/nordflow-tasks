import { Router } from "express";
import { get, query, run } from "../db.js";
import { requireAuth } from "../auth.js";
import { ah, httpError } from "../util.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  ah(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const notifications = await query(
      `SELECT n.*, t.code AS task_code, t.title AS task_title
       FROM notifications n
       LEFT JOIN tasks t ON t.id = n.task_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ${limit}`,
      [req.user.id],
    );
    const unread = await get(
      "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0",
      [req.user.id],
    );
    res.json({
      notifications: notifications.map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
      unread_count: Number(unread?.c || 0),
    });
  }),
);

router.get(
  "/unread",
  ah(async (req, res) => {
    const unread = await get(
      "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0",
      [req.user.id],
    );
    res.json({ unread_count: Number(unread?.c || 0) });
  }),
);

router.post(
  "/:id/read",
  ah(async (req, res) => {
    const notification = await get("SELECT * FROM notifications WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (!notification || notification.user_id !== req.user.id) {
      throw httpError(404, "Уведомление не найдено");
    }
    await run("UPDATE notifications SET is_read = 1 WHERE id = ?", [notification.id]);
    res.json({ ok: true });
  }),
);

router.post(
  "/read-all",
  ah(async (req, res) => {
    await run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id]);
    res.json({ ok: true });
  }),
);

router.delete(
  "/:id",
  ah(async (req, res) => {
    const notification = await get("SELECT * FROM notifications WHERE id = ?", [
      Number(req.params.id),
    ]);
    if (!notification || notification.user_id !== req.user.id) {
      throw httpError(404, "Уведомление не найдено");
    }
    await run("DELETE FROM notifications WHERE id = ?", [notification.id]);
    res.json({ ok: true });
  }),
);

export default router;
