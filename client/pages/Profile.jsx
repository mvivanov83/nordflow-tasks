import { useRef, useState } from "react";
import { api, uploadFile } from "../api.js";
import Icon from "../icons.jsx";
import { Avatar, Field, RoleBadge, Spinner } from "../ui.jsx";
import { applyTheme, useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";
import { formatDate } from "../utils.js";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    position: user?.position || "",
  });
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [theme, setTheme] = useState(user?.theme === "dark" ? "dark" : "light");
  const [uploading, setUploading] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileError("");
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setProfileError("Имя и фамилия обязательны");
      return;
    }
    setSaving(true);
    try {
      const data = await api("/profile", {
        method: "PATCH",
        body: { ...form, theme },
      });
      updateUser(data.user);
      toast("Профиль сохранён");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function chooseTheme(next) {
    setTheme(next);
    applyTheme(next);
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadFile("/profile/avatar", file, "avatar");
      updateUser(data.user);
      toast("Аватар обновлён");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    if (passwords.next.length < 6) {
      setPasswordError("Новый пароль должен содержать не менее 6 символов");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError("Новый пароль и подтверждение не совпадают");
      return;
    }
    setPasswordSaving(true);
    try {
      await api("/profile/password", {
        method: "POST",
        body: { current_password: passwords.current, new_password: passwords.next },
      });
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordOpen(false);
      toast("Пароль изменён");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="page-stack profile-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Профиль</span>
          <h1>Настройки профиля</h1>
          <p className="page-subtitle">Личные данные, внешний вид и безопасность учётной записи.</p>
        </div>
      </div>

      <div className="profile-layout">
        <aside className="card profile-card">
          <div className="profile-avatar">
            <Avatar user={user} size={92} />
            <button
              type="button"
              className="profile-avatar-edit"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Загрузить новый аватар"
            >
              {uploading ? <Spinner size={16} /> : <Icon name="upload" size={16} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </div>
          <h2>{user.first_name} {user.last_name}</h2>
          <p className="muted">{user.position || "Сотрудник"}</p>
          <RoleBadge role={user.role} />
          <div className="profile-meta">
            <div>
              <span>Почта</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>В системе с</span>
              <strong>{formatDate(user.created_at)}</strong>
            </div>
            <div>
              <span>Статус</span>
              <strong className="profile-active">Активна</strong>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} />
            Заменить аватар
          </button>
          <p className="muted-small">JPG, PNG или WebP, не более 5 МБ.</p>
        </aside>

        <div className="profile-main">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Личные данные</h2>
                <p>Имя и должность видны коллегам в задачах и комментариях</p>
              </div>
            </div>

            <form className="form" onSubmit={saveProfile}>
              {profileError ? <div className="form-error span-2">{profileError}</div> : null}
              <Field label="Имя" required>
                <input value={form.first_name} onChange={(event) => update("first_name", event.target.value)} />
              </Field>
              <Field label="Фамилия" required>
                <input value={form.last_name} onChange={(event) => update("last_name", event.target.value)} />
              </Field>
              <Field label="Должность">
                <input
                  value={form.position}
                  onChange={(event) => update("position", event.target.value)}
                  placeholder="Например, старший дизайнер"
                />
              </Field>
              <Field label="Электронная почта" hint="Почту может изменить только администратор">
                <input value={user.email} readOnly disabled />
              </Field>
              <Field label="Роль" hint="Роль назначается администратором">
                <input value={user.role === "admin" ? "Администратор" : user.role === "manager" ? "Руководитель проекта" : "Сотрудник"} readOnly disabled />
              </Field>
              <div className="form-actions span-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner size={16} /> : <Icon name="check" size={16} />}
                  Сохранить изменения
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Внешний вид</h2>
                <p>Тема применяется сразу и сохраняется в профиле</p>
              </div>
            </div>
            <div className="theme-picker">
              <button
                type="button"
                className={`theme-option ${theme === "light" ? "active" : ""}`}
                onClick={() => chooseTheme("light")}
              >
                <span className="theme-preview theme-preview-light">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="theme-option-label">
                  <Icon name="sun" size={17} />
                  Светлая
                </span>
              </button>
              <button
                type="button"
                className={`theme-option ${theme === "dark" ? "active" : ""}`}
                onClick={() => chooseTheme("dark")}
              >
                <span className="theme-preview theme-preview-dark">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="theme-option-label">
                  <Icon name="moon" size={17} />
                  Тёмная
                </span>
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Безопасность</h2>
                <p>Пароль должен содержать не менее 6 символов</p>
              </div>
              {!passwordOpen ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPasswordOpen(true)}>
                  <Icon name="settings" size={15} />
                  Изменить пароль
                </button>
              ) : null}
            </div>

            {passwordOpen ? (
              <form className="form" onSubmit={changePassword}>
                {passwordError ? <div className="form-error span-2">{passwordError}</div> : null}
                <Field label="Текущий пароль" required className="span-2">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, current: event.target.value }))}
                  />
                </Field>
                <Field label="Новый пароль" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, next: event.target.value }))}
                  />
                </Field>
                <Field label="Подтверждение" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))}
                  />
                </Field>
                <div className="form-actions span-2">
                  <button type="button" className="btn btn-ghost" onClick={() => setPasswordOpen(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                    {passwordSaving ? <Spinner size={16} /> : null}
                    Сохранить пароль
                  </button>
                </div>
              </form>
            ) : (
              <p className="muted">
                Регулярно меняйте пароль и не передавайте его коллегам. При подозрении на утечку
                смените пароль и сообщите администратору.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
