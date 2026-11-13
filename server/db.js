import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const dialect = process.env.DATABASE_URL ? "postgres" : "sqlite";

let sqlite = null;
let pool = null;

if (dialect === "postgres") {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
} else {
  const file = process.env.DATABASE_FILE || path.join(ROOT, "data", "nordflow.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
}

export function isPostgres() {
  return dialect === "postgres";
}

function normalizeParam(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === "object" && !(value instanceof Uint8Array)) {
    return JSON.stringify(value);
  }
  return value;
}

function normalizeParams(params) {
  return params.map(normalizeParam);
}

/** Convert `?` placeholders to PostgreSQL `$1, $2, ...` */
function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function query(sql, params = []) {
  if (dialect === "postgres") {
    const result = await pool.query(toPgSql(sql), normalizeParams(params));
    return result.rows;
  }
  const rows = sqlite.prepare(sql).all(...normalizeParams(params));
  return rows.map((row) => ({ ...row }));
}

export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  if (dialect === "postgres") {
    const result = await pool.query(toPgSql(sql), normalizeParams(params));
    return { changes: result.rowCount || 0 };
  }
  const result = sqlite.prepare(sql).run(...normalizeParams(params));
  return { changes: Number(result.changes || 0) };
}

export async function insert(sql, params = []) {
  if (dialect === "postgres") {
    const clean = sql.trim().replace(/;$/, "");
    const result = await pool.query(`${toPgSql(clean)} RETURNING id`, normalizeParams(params));
    return result.rows[0].id;
  }
  const result = sqlite.prepare(sql).run(...normalizeParams(params));
  return Number(result.lastInsertRowid);
}

export async function exec(sql) {
  if (dialect === "postgres") {
    await pool.query(sql);
    return;
  }
  sqlite.exec(sql);
}

export async function getSetting(key, fallback = null) {
  const row = await get("SELECT v FROM settings WHERE k = ?", [key]);
  return row ? row.v : fallback;
}

export async function setSetting(key, value) {
  const existing = await get("SELECT k FROM settings WHERE k = ?", [key]);
  if (existing) {
    await run("UPDATE settings SET v = ? WHERE k = ?", [String(value), key]);
  } else {
    await run("INSERT INTO settings (k, v) VALUES (?, ?)", [key, String(value)]);
  }
}

export async function closeDb() {
  if (dialect === "postgres") await pool.end();
  else if (sqlite) sqlite.close();
}
