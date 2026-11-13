import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { ROOT } from "./db.js";
import { httpError } from "./util.js";

const configuredUploadsDir = String(process.env.UPLOADS_DIR || "").trim();
export const UPLOADS_ROOT = configuredUploadsDir
  ? path.resolve(ROOT, configuredUploadsDir)
  : path.join(ROOT, "uploads");
export const AVATARS_DIR = path.join(UPLOADS_ROOT, "avatars");
export const ATTACHMENTS_DIR = path.join(UPLOADS_ROOT, "attachments");

fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

function safeExtension(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

function storageFor(directory) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, directory),
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension(file.originalname)}`);
    },
  });
}

export const avatarUpload = multer({
  storage: storageFor(AVATARS_DIR),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(httpError(400, "Для аватара нужен файл изображения"));
    }
    cb(null, true);
  },
});

export const attachmentUpload = multer({
  storage: storageFor(ATTACHMENTS_DIR),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export function removeLocalUpload(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return;
  const relative = url.replace(/^\/uploads\//, "");
  const target = path.resolve(UPLOADS_ROOT, relative);
  if (!target.startsWith(UPLOADS_ROOT)) return;
  fs.promises.unlink(target).catch(() => {});
}
