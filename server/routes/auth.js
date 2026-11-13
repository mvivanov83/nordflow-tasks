import { Router } from "express";
import bcrypt from "bcryptjs";
import { get } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { ah, httpError, publicUser } from "../util.js";

const router = Router();

router.post(
  "/login",
  ah(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      throw httpError(400, "Введите электронную почту и пароль");
    }

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) throw httpError(401, "Неверная почта или пароль");
    if (!user.is_active) throw httpError(403, "Учётная запись отключена администратором");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw httpError(401, "Неверная почта или пароль");

    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get(
  "/me",
  requireAuth,
  ah(async (req, res) => {
    res.json({ user: req.publicUser });
  }),
);

router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

export default router;
