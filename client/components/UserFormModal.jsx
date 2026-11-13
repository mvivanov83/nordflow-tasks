import { useState } from "react";
import { api } from "../api.js";
import { Field, Modal, Spinner } from "../ui.jsx";
import { ROLES } from "../constants.js";
import { useToast } from "../toast.jsx";

export default function UserFormModal({ user = null, onClose, onSaved }) {
  const isEdit = Boolean(user);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    position: user?.position || "",
    role: user?.role || "employee",
    password: "",
    is_active: user ? Boolean(user.is_active) : true,
  });

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.first_name.trim() || !form.last_name.trim()) return setError("Имя и фамилия обязательны");
    if (!form.email.trim()) return setError("Укажите электронную почту");
    if (!isEdit && form.password.length < 6) return setError("Пароль должен содержать не менее 6 символов");

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        position: form.position,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (isEdit) payload.is_active = form.is_active ? 1 : 0;

      const data = isEdit
        ? await api(`/users/${user.id}`, { method: "PATCH", body: payload })
        : await api("/users", { method: "POST", body: payload });

      toast(isEdit ? "Пользователь обновлён" : "Пользователь создан");
      onSaved?.(data.user);
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
      title={isEdit ? "Редактировать пользователя" : "Новый пользователь"}
      subtitle={isEdit ? "Почту и роль может изменять только администратор." : "Самостоятельная регистрация в MVP отключена."}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" form="user-form" className="btn btn-cta" disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            {isEdit ? "Сохранить" : "Создать пользователя"}
          </button>
        </>
      }
    >
      <form id="user-form" className="form" onSubmit={handleSubmit}>
        {error ? <div className="form-error">{error}</div> : null}

        <Field label="Имя" required>
          <input value={form.first_name} onChange={(event) => update("first_name", event.target.value)} autoFocus />
        </Field>
        <Field label="Фамилия" required>
          <input value={form.last_name} onChange={(event) => update("last_name", event.target.value)} />
        </Field>
        <Field label="Электронная почта" required className="span-2">
          <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        </Field>
        <Field label="Должность" className="span-2">
          <input value={form.position} onChange={(event) => update("position", event.target.value)} placeholder="Например, дизайнер" />
        </Field>
        <Field label="Роль">
          <select value={form.role} onChange={(event) => update("role", event.target.value)}>
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
        </Field>
        <Field
          label={isEdit ? "Новый пароль" : "Пароль"}
          required={!isEdit}
          hint={isEdit ? "Оставьте пустым, чтобы не менять" : "Минимум 6 символов"}
        >
          <input
            type="password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder={isEdit ? "Без изменений" : "Минимум 6 символов"}
            autoComplete="new-password"
          />
        </Field>

        {isEdit ? (
          <label className="check span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => update("is_active", event.target.checked)}
            />
            <span>Учётная запись активна (сотрудник может входить в систему)</span>
          </label>
        ) : null}
      </form>
    </Modal>
  );
}
