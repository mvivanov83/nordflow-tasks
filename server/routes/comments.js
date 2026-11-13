import { Router } from "express";
import { get, run, insert } from "../db.js";
import { requireAuth } from "../auth.js";
import { requireTaskAccess } from "../access.js";
import { notifySafe } from "../notify.js";
import { ah, cleanString, httpError, nowIso } from "../util.js";

const router = Router();
router.use(requireAuth);

async function commentWithAuthor(id) {
  return get(
    `SELECT c.*, u.first_name || ' ' || u.last_name AS author_name,
       u.avatar_url AS author_avatar, u.position AS author_position
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [id],
  );
}

router.post(
  "/tasks/:taskId/comments",
  ah(async (req, res) => {
    const access = await requireTaskAccess(req.user, Number(req.params.taskId));
    const body = cleanString(req.body?.body, 5000);
    if (!body) throw httpError(400, "Комментарий не может быть пустым");

    const timestamp = nowIso();
    const id = await insert(
      "INSERT INTO comments (task_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [access.task.id, req.user.id, body, timestamp, timestamp],
    );

    await run(
      `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
       VALUES (?, ?, 'comment_added', NULL, NULL, ?, ?)`,
      [access.task.id, req.user.id, cleanString(body, 200), timestamp],
    );

    const targets = new Set(
      [access.task.assignee_id, access.task.reporter_id].filter(
        (userId) => userId && userId !== req.user.id,
      ),
    );
    for (const userId of targets) {
      await notifySafe({
        userId,
        type: "comment",
        title: `Новый комментарий к ${access.task.code}`,
        body: cleanString(body, 180),
        taskId: access.task.id,
        projectId: access.task.project_id,
      });
    }

    res.status(201).json({ comment: await commentWithAuthor(id) });
  }),
);

router.patch(
  "/comments/:id",
  ah(async (req, res) => {
    const comment = await get("SELECT * FROM comments WHERE id = ?", [Number(req.params.id)]);
    if (!comment) throw httpError(404, "Комментарий не найден");
    await requireTaskAccess(req.user, comment.task_id);
    if (comment.user_id !== req.user.id) {
      throw httpError(403, "Можно редактировать только собственные комментарии");
    }
    const body = cleanString(req.body?.body, 5000);
    if (!body) throw httpError(400, "Комментарий не может быть пустым");
    await run("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?", [
      body,
      nowIso(),
      comment.id,
    ]);
    res.json({ comment: await commentWithAuthor(comment.id) });
  }),
);

router.delete(
  "/comments/:id",
  ah(async (req, res) => {
    const comment = await get("SELECT * FROM comments WHERE id = ?", [Number(req.params.id)]);
    if (!comment) throw httpError(404, "Комментарий не найден");
    await requireTaskAccess(req.user, comment.task_id);
    if (comment.user_id !== req.user.id && req.user.role !== "admin") {
      throw httpError(403, "Удалить комментарий может автор или администратор");
    }
    await run("DELETE FROM comments WHERE id = ?", [comment.id]);
    await run(
      `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
       VALUES (?, ?, 'comment_deleted', NULL, ?, NULL, ?)`,
      [comment.task_id, req.user.id, cleanString(comment.body, 200), nowIso()],
    );
    res.json({ ok: true });
  }),
);

export default router;
