import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Icon from "../icons.jsx";
import { Spinner } from "../ui.jsx";

const DEMO_ACCOUNTS = [
  {
    role: "Администратор",
    name: "Анна Волкова",
    email: "admin@nordflow.ru",
    password: "Admin123!",
  },
  {
    role: "Руководитель проекта",
    name: "Максим Орлов",
    email: "manager@nordflow.ru",
    password: "Manager123!",
  },
  {
    role: "Сотрудник",
    name: "Елена Соколова",
    email: "elena@nordflow.ru",
    password: "Demo123!",
  },
  {
    role: "Сотрудник",
    name: "Виктор Лебедев",
    email: "viktor@nordflow.ru",
    password: "Demo123!",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Введите электронную почту и пароль");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      const from = location.state?.from;
      navigate(from && !from.startsWith("/login") ? from : "/", { replace: true });
    } catch (err) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero-content">
          <div className="login-brand">
            <span className="brand-mark brand-mark-lg" aria-hidden="true">
              <img src="/brand/logo-main.png" alt="" />
            </span>
            <div>
              <strong>NordFlow</strong>
              <span>Tasks</span>
            </div>
          </div>

          <h1>Все проекты и задачи команды — в одном месте</h1>
          <p className="login-lead">
            Внутренний трекер NordFlow: понятная Kanban-доска, сроки, комментарии
            и уведомления без сложных настроек.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <span><Icon name="grid" size={19} /></span>
              <div>
                <strong>Kanban без обучения</strong>
                <small>Перетаскивайте карточки между статусами</small>
              </div>
            </div>
            <div className="login-feature">
              <span><Icon name="clock" size={19} /></span>
              <div>
                <strong>Сроки под контролем</strong>
                <small>Просрочки и ближайшие дедлайны всегда на виду</small>
              </div>
            </div>
            <div className="login-feature">
              <span><Icon name="bell" size={19} /></span>
              <div>
                <strong>Уведомления в приложении</strong>
                <small>Назначения, смена статусов и комментарии</small>
              </div>
            </div>
          </div>

          <div className="login-hero-foot">
            <span className="login-team-dots">
              {["АВ", "МО", "ЕС", "ИМ", "ВЛ"].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
            <span>Команда NordFlow · 35 человек</span>
          </div>
        </div>
        <div className="login-hero-glow login-hero-glow-1" />
        <div className="login-hero-glow login-hero-glow-2" />
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <span className="mobile-brand">
              <span className="brand-mark" aria-hidden="true">
                <img src="/brand/logo-icon.png" alt="" />
              </span>
              <strong>NordFlow Tasks</strong>
            </span>
            <h2>Вход в систему</h2>
            <p>Используйте рабочую почту и пароль, выданный администратором.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error ? (
              <div className="form-error">
                <Icon name="alert" size={16} />
                {error}
              </div>
            ) : null}

            <label className="field">
              <span className="field-label">Электронная почта</span>
              <div className="input-with-icon">
                <Icon name="user" size={17} />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="name@nordflow.ru"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Пароль</span>
              <div className="input-with-icon">
                <Icon name="settings" size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
            </label>

            <button type="submit" className="btn btn-cta btn-block btn-lg" disabled={loading}>
              {loading ? <Spinner size={17} /> : null}
              Войти
            </button>
          </form>

          <div className="demo-access">
            <button type="button" className="demo-toggle" onClick={() => setShowDemo((value) => !value)}>
              <span>
                <Icon name="shield" size={16} />
                Демо-доступы
              </span>
              <Icon name={showDemo ? "chevronDown" : "chevronRight"} size={16} />
            </button>
            {showDemo ? (
              <div className="demo-list">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="demo-account"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError("");
                    }}
                  >
                    <span className="demo-account-role">{account.role}</span>
                    <span className="demo-account-main">
                      <strong>{account.name}</strong>
                      <small>{account.email}</small>
                    </span>
                    <span className="demo-account-pass">{account.password}</span>
                  </button>
                ))}
                <p className="demo-hint">Нажмите на аккаунт, чтобы подставить данные для входа.</p>
              </div>
            ) : null}
          </div>
        </div>

        <p className="login-copyright">NordFlow Tasks · Внутренний сервис компании NordFlow</p>
      </div>
    </div>
  );
}
