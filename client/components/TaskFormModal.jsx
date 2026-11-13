import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, Spinner } from "../ui.jsx";
import { PRIORITIES, STATUSES } from "../constants.js";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";

export default function TaskFormModal({
  onClose,
  onCreated,
  projects = [],
  projectId = null,
  defaultStatus = "backlog",
}) {
  const { user } = useAuth();
  const { bump } = useData();
  const { toast } = useToast();

  const isAdmin = user?.role === "admin";
  const availableProjects = projects.filter(
    (project) =>
      project &&
      (isAdmin ||
        project.id === Number(projectId) ||
        project.my_permissions?.can_create_tasks),
  );

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: projectId || availableProjects[0]?.id || "",
    status: defaultStatus,
    priority: "medium",
    assignee_id: user?.id || "",
    due_date: "",
    tags: "",
  });

  useEffect(() => {
    let active = true;
    api("/users")
      .then((data) => {
        if (active) setUsers(data.users);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Укажите название задачи");
    if (!form.project_id) return setError("Выберите проект");
    if (!form.assignee_id) return setError("Выберите исполнителя");

    setSaving(true);
    try {
      const data = await api("/tasks", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          project_id: Number(form.project_id),
          status: form.status,
          priority: form.priority,
          assignee_id: Number(form.assignee_id),
          due_date: form.due_date || null,
          tags: form.tags,
        },
      });
      toast(`Задача ${data.task.code} создана`);
      bump();
      onCreated?.(data.task);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!availableProjects.length) {
    return (
      <Modal open title="Новая задача" onClose={onClose} size="sm">
        <p className="muted">
          У вас нет проектов, где разрешено создание задач. Обратитесь к руководителю проекта.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title="Новая задача"
      subtitle="Задача появится на доске выбранного проекта, исполнитель получит уведомление."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" form="create-task-form" className="btn btn-cta" disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            Создать задачу
          </button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} className="form">
        {error ? <div className="form-error">{error}</div> : null}

        <Field label="Название задачи" required className="span-2">
          <input
            autoFocus
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Например, подготовить макет главной страницы"
            maxLength={200}
          />
        </Field>

        <Field label="Проект" required>
          <select
            value={form.project_id}
            onChange={(event) => update("project_id", event.target.value)}
          >
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Исполнитель" required>
          <select
            value={form.assignee_id}
            onChange={(event) => update("assignee_id", event.target.value)}
            disabled={loadingUsers}
          >
            <option value="">Выберите сотрудника</option>
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name} — {member.position}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Статус">
          <select value={form.status} onChange={(event) => update("status", event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Приоритет">
          <select value={form.priority} onChange={(event) => update("priority", event.target.value)}>
            {PRIORITIES.map((priority) => (
              <option key={priority.id} value={priority.id}>{priority.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Дедлайн">
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => update("due_date", event.target.value)}
          />
        </Field>

        <Field label="Теги" hint="Укажите через запятую, например: дизайн, клиент">
          <input
            value={form.tags}
            onChange={(event) => update("tags", event.target.value)}
            placeholder="дизайн, клиент"
          />
        </Field>

        <Field label="Описание" className="span-2">
          <textarea
            rows={5}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Контекст, требования, ссылки на материалы…"
          />
        </Field>

        <p className="form-note span-2">
          Постановщик: <strong>{user?.first_name} {user?.last_name}</strong>. Вложения можно добавить
          после создания задачи.
        </p>
      </form>
    </Modal>
  );
}
