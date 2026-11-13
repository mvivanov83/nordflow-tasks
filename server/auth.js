import jwt from "jsonwebtoken";
import { get } from "./db.js";
import { httpError, publicUser } from "./util.js";

const SECRET = process.env.JWT_SECRET || "nordflow-tasks-mvp-dev-secret";
const TOKEN_TTL = "7d";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[auth] JWT_SECRET не задан — используется значение по умолчанию.");
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: TOKEN_TTL });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw httpError(401, "Требуется авторизация");

    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      throw httpError(401, "Сессия истекла, войдите снова");
    }

    const user = await get("SELECT * FROM users WHERE id = ?", [payload.sub]);
    if (!user || !user.is_active) throw httpError(401, "Пользователь не найден или заблокирован");

    req.user = user;
    req.publicUser = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(httpError(403, "Действие доступно только администратору"));
  }
  next();
}
