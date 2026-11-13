import { dialect, exec } from "./db.js";

export async function initSchema() {
  const id = dialect === "postgres" ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${id},
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'employee',
      avatar_url TEXT,
      theme TEXT NOT NULL DEFAULT 'light',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      k TEXT PRIMARY KEY,
      v TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id ${id},
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      manager_id INTEGER NOT NULL REFERENCES users(id),
      start_date TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      can_create_tasks INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id ${id},
      code TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      due_date TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS comments (
      id ${id},
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS task_history (
      id ${id},
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS attachments (
      id ${id},
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'link',
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id ${id},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      is_read INTEGER NOT NULL DEFAULT 0,
      dedupe_key TEXT,
      created_at TEXT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)",
    "CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id)",
  ];

  for (const statement of statements) {
    await exec(statement);
  }
}

export async function resetData() {
  const tables = [
    "notifications",
    "attachments",
    "task_history",
    "comments",
    "tasks",
    "project_members",
    "projects",
    "settings",
    "users",
  ];
  for (const table of tables) {
    await exec(`DELETE FROM ${table}`);
  }
  if (dialect === "postgres") {
    for (const table of tables) {
      await exec(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
    }
  } else {
    await exec("DELETE FROM sqlite_sequence");
  }
}
