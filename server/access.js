import { get } from "./db.js";
import { httpError } from "./util.js";

export function projectAccessWhere(user, alias = "p") {
  if (user.role === "admin") {
    return { sql: "1 = 1", params: [] };
  }
  return {
    sql: `(${alias}.manager_id = ? OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = ${alias}.id AND pm.user_id = ?
    ))`,
    params: [user.id, user.id],
  };
}

export async function getProjectAccess(user, projectId) {
  const project = await get("SELECT * FROM projects WHERE id = ?", [projectId]);
  if (!project) return null;

  if (user.role === "admin") {
    return {
      project,
      isAdmin: true,
      isManager: project.manager_id === user.id,
      isMember: true,
      canCreateTasks: true,
    };
  }

  const isManager = project.manager_id === user.id;
  const member = await get(
    "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, user.id],
  );

  if (!isManager && !member) return null;

  return {
    project,
    isAdmin: false,
    isManager,
    isMember: Boolean(member),
    canCreateTasks: isManager || Boolean(member?.can_create_tasks),
    canCreateTasksByGrant: Boolean(member?.can_create_tasks),
  };
}

export async function requireProjectAccess(user, projectId) {
  const access = await getProjectAccess(user, projectId);
  if (!access) throw httpError(403, "Нет доступа к этому проекту");
  return access;
}

export async function getTaskAccess(user, taskId) {
  const task = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) return null;
  const access = await getProjectAccess(user, task.project_id);
  if (!access) return null;
  return {
    ...access,
    task,
    canEditTask:
      access.isAdmin || access.isManager || task.reporter_id === user.id,
    canMoveTask:
      access.isAdmin || access.isManager || task.assignee_id === user.id,
  };
}

export async function requireTaskAccess(user, taskId) {
  const access = await getTaskAccess(user, taskId);
  if (!access) throw httpError(404, "Задача не найдена или недоступна");
  return access;
}
