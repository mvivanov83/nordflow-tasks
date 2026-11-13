import { Router } from "express";
import bcrypt from "bcryptjs";
import { get, run } from "../db.js";
import { requireAuth } from "../auth.js";
import { avatarUpload, removeLocalUpload } from "../uploads.js";
import { ah, cleanString, httpError, publicUser } from "../util.js";

const router = Router();
router.use(requireAuth);

router.patch(
  "/",
  ah(async (req, res) => {
    const first_name = cleanString(req.body?.first_name, 80);
    const last_name = cleanString(req.body?.last_name, 80);
    const position = cleanString(req.body?.position, 120);
    const theme = req.body?.theme === "dark" ? "dark" : "light";

    if (!first_name || !last_name) throw httpError(400, "Имя и фамилия обязательны");

    await run(
      "UPDATE users SET first_name = ?, last_name = ?, position = ?, theme = ? WHERE id = ?",
      [first_name, last_name, position, theme, req.user.id],
    );

    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  "/avatar",
  avatarUpload.single("avatar"),
  ah(async (req, res) => {
    if (!req.file) throw httpError(400, "Файл не загружен");
    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (user.avatar_url) removeLocalUpload(user.avatar_url);
    const url = `/uploads/avatars/${req.file.filename}`;
    await run("UPDATE users SET avatar_url = ? WHERE id = ?", [url, req.user.id]);
    const updated = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({ user: publicUser(updated) });
  }),
);

router.post(
  "/password",
  ah(async (req, res) => {
    const current = String(req.body?.current_password || "");
    const next = String(req.body?.new_password || "");
    if (next.length < 6) throw httpError(400, "Новый пароль должен содержать не менее 6 символов");

    const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    const valid = await bcrypt.compare(current, user.password_hash);
    if (!valid) throw httpError(400, "Текущий пароль указан неверно");

    const hash = await bcrypt.hash(next, 10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    res.json({ ok: true });
  }),
);

export default router;
