import { Link } from "react-router-dom";
import Icon from "../icons.jsx";

export default function NotFound() {
  return (
    <div className="notfound-page">
      <div className="notfound-card card">
        <span className="notfound-code">404</span>
        <div className="notfound-icon">
          <Icon name="search" size={30} />
        </div>
        <h1>Страница не найдена</h1>
        <p>
          Возможно, ссылка устарела или у вас нет доступа к этому разделу. Вернитесь
          на главную и продолжите работу с задачами.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">
            <Icon name="dashboard" size={16} />
            На главную
          </Link>
          <Link to="/my-tasks" className="btn btn-secondary">
            <Icon name="tasks" size={16} />
            Мои задачи
          </Link>
        </div>
      </div>
    </div>
  );
}
