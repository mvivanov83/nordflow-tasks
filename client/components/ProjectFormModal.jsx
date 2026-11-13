import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, Spinner } from "../ui.jsx";
import { PROJECT_STATUSES } from "../constants.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

export default function ProjectFormModal({ project = null, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = Boolean(project);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: project?.name || "",
    description: project?.description || "",
    manager_id: project?.manager_id || "",
    start_date: project?.start_date || "",
    due_date: project?.due_date || "",
    status: project?.status === "archived" ? "active" : project?.status || "planning",
  });
  const [memberState, setMemberState] = useState({});

  useEffect(() => {
    if (isEdit) return undefined;
    let active = true;
    api("/users")
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        const initial = {};
        for (const member of data.users) {
          initial[member.id] = { selected: false, canCreate: false };
        }
        const manager = data.users.find((item) => item.role === "manager" || item.role === "admin");
        if (manager) {
          initial[manager.id] = { selected: true, canCreate: true };
          setForm((previous) => ({ ...previous, manager_id: manager.id }));
        }
        setMemberState(initial);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isEdit]);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function toggleMember(id) {
    setMemberState((previous) => ({
      ...previous,
      [id]: {
        selected: !previous[id]?.selected,
        canCreate: !previous[id]?.selected ? false : previous[id]?.canCreate,
      },
    }));
  }

  function toggleCanCreate(id) {
    setMemberState((previous) => ({
      ...previous,
      [id]: { ...previous[id], canCreate: !previous[id]?.canCreate },
    }));
  }

  function selectManager(id) {
    update("manager_id", id);
    setMemberState((previous) => ({
      ...previous,
      [id]: { selected: true, canCreate: true },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Укажите название проекта");
    if (!form.manager_id) return setError("Выберите руководителя проекта");
    if (form.start_date && form.due_date && form.start_date > form.due_date) {
      return setError("Дата завершения не может быть раньше даты начала");
    }

    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          name: form.name,
          description: form.description,
          start_date: form.start_date || null,
          due_date: form.due_date || null,
          status: form.status,
        };
        if (user.role === "admin") payload.manager_id = Number(form.manager_id);
        const data = await api(`/projects/${project.id}`, { method: "PATCH", body: payload });
        toast("Проект обновлён");
        onSaved?.(data);
      } else {
        const members = Object.entries(memberState)
          .filter(([id, state]) => state.selected && Number(id) !== Number(form.manager_id))
          .map(([id, state]) => ({
            user_id: Number(id),
            can_create_tasks: state.canCreate,
          }));
        const data = await api("/projects", {
          method: "POST",
          body: {
            name: form.name,
            description: form.description,
            manager_id: Number(form.manager_id),
            start_date: form.start_date || null,
            due_date: form.due_date || null,
            status: form.status,
            members,
          },
        });
        toast("Проект создан");
        onSaved?.(data);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? "Редактировать проект" : "Новый проект"}
      subtitle={isEdit ? "Изменения увидят все участники проекта." : "Заполните карточку проекта и добавьте участников."}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" form="project-form" className="btn btn-cta" disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            {isEdit ? "Сохранить" : "Создать проект"}
          </button>
        </>
      }
    >
      <form id="project-form" className="form" onSubmit={handleSubmit}>
        {error ? <div className="form-error">{error}</div> : null}

        <Field label="Название проекта" required className="span-2">
          <input
            autoFocus
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Например, запуск нового сайта"
            maxLength={160}
          />
        </Field>

        <Field label="Описание" className="span-2">
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Цель проекта, ключевые результаты, особенности работы"
          />
        </Field>

        <Field label="Руководитель проекта" required>
          <select
            value={form.manager_id}
            onChange={(event) => selectManager(event.target.value)}
            disabled={loading || (isEdit && user.role !== "admin")}
          >
            <option value="">Выберите руководителя</option>
            {loading ? <option>Загрузка…</option> : null}
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name} — {member.position || member.email}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Статус">
          <select value={form.status} onChange={(event) => update("status", event.target.value)}>
            {PROJECT_STATUSES.filter((status) => status.id !== "archived").map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Дата начала">
          <input type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
        </Field>

        <Field label="Плановая дата завершения">
          <input type="date" value={form.due_date} onChange={(event) => update("due_date", event.target.value)} />
        </Field>

        {!isEdit ? (
          <div className="span-2 members-picker">
            <div className="members-picker-head">
              <div>
                <span className="field-label">Участники</span>
                <p className="field-hint">Отметьте сотрудников и при необходимости разрешите им создавать задачи.</p>
              </div>
              {loading ? <Spinner size={18} /> : null}
            </div>
            <div className="members-picker-list">
              {users.map((member) => {
                const state = memberState[member.id] || {};
                const isManager = Number(member.id) === Number(form.manager_id);
                return (
                  <div key={member.id} className={`member-pick ${state.selected ? "selected" : ""}`}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={Boolean(state.selected)}
                        disabled={isManager}
                        onChange={() => toggleMember(member.id)}
                      />
                      <span>
                        <strong>{member.first_name} {member.last_name}</strong>
                        <small>{member.position}</small>
                      </span>
                    </label>
                    {state.selected ? (
                      <label className="check check-small">
                        <input
                          type="checkbox"
                          checked={isManager || Boolean(state.canCreate)}
                          disabled={isManager}
                          onChange={() => toggleCanCreate(member.id)}
                        />
                        <span>Может создавать задачи</span>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
