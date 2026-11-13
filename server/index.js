import fs from "node:fs";
import path from "node:path";
import express from "express";
import { closeDb, query, ROOT } from "./db.js";
import { initSchema } from "./schema.js";
import { seedDemoData } from "./seed.js";
import { sweepDeadlines } from "./notify.js";
import { UPLOADS_ROOT } from "./uploads.js";

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import commentRoutes from "./routes/comments.js";
import attachmentRoutes from "./routes/attachments.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import teamRoutes from "./routes/team.js";
import searchRoutes from "./routes/search.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/uploads",
  express.static(UPLOADS_ROOT, {
    maxAge: "7d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ status: "ok", database: process.env.DATABASE_URL ? "postgres" : "sqlite" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api", commentRoutes);
app.use("/api", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/search", searchRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Метод API не найден" });
});

const distDir = path.join(ROOT, "dist");
if (fs.existsSync(path.join(distDir, "index.html"))) {
  app.use(express.static(distDir, { index: false, maxAge: "7d" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res
      .status(200)
      .send("NordFlow Tasks API запущен. Соберите клиент командой npm run build.");
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  if (err.name === "MulterError") status = 400;
  if (err.type === "entity.too.large") status = 413;
  if (status >= 500) {
    console.error("[server]", err);
  }
  const message =
    status >= 500 ? "Внутренняя ошибка сервера" : err.message || "Ошибка запроса";
  res.status(status).json({ error: message });
});

async function start() {
  await initSchema();
  await seedDemoData();
  await sweepDeadlines();
  setInterval(() => sweepDeadlines(), 30 * 60 * 1000).unref();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[nordflow] сервер запущен на http://localhost:${PORT}`);
    console.log(`[nordflow] база данных: ${process.env.DATABASE_URL ? "PostgreSQL" : "SQLite"}`);
  });

  const shutdown = async (signal) => {
    console.log(`[nordflow] получен ${signal}, останавливаюсь...`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("[nordflow] не удалось запустить сервер:", error);
  process.exit(1);
});
