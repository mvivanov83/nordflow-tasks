import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  EmptyState,
  PageLoader,
  PriorityBadge,
  StatusBadge,
} from "../ui.jsx";
import { useData } from "../data.jsx";
import { formatDate } from "../utils.js";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { openTask } = useData();

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    const value = queryParam.trim();
    if (value.length < 2) {
      setResults(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        setResults(data);
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [queryParam]);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setSearchParams({ q: value }, { replace: true });
  }

  const total = results
    ? results.projects.length + results.tasks.length + results.users.length
    : 0;

  return (
    <div className="page-stack search-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Поиск</span>
          <h1>{queryParam ? `Результаты по запросу «${queryParam}»` : "Поиск по рабочему пространству"}</h1>
          <p className="page-subtitle">
            {queryParam
              ? `${total} ${total === 1 ? "результат" : total > 1 && total < 5 ? "результата" : "результатов"} в проектах, задачах и сотрудниках`
              : "Ищите задачи по номеру или названию, проекты и сотрудников по имени или почте."}
          </p>
        </div>
      </div>

      <form className="search-page-form card" onSubmit={submit}>
        <Icon name="search" size={19} />
        <input
          type="search"
          value={query}
          placeholder="Введите минимум 2 символа"
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={query.trim().length < 2}>
          Найти
        </button>
      </form>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <PageLoader label="Ищем по данным…" /> : null}

      {!loading && queryParam.trim().length < 2 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Начните вводить запрос"
            text="Например: NDF-101, лендинг, Соколова или «дизайн»."
          />
        </div>
      ) : null}

      {!loading && queryParam.trim().length >= 2 && results && !total ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Ничего не найдено"
            text={`По запросу «${queryParam}» нет совпадений. Попробуйте другой номер задачи, название или имя.`}
          />
        </div>
      ) : null}

      {!loading && results && total ? (
        <div className="search-page-groups">
          {results.projects.length ? (
            <section className="card search-page-group">
              <div className="card-head">
                <div>
                  <h2>Проекты</h2>
                  <p>{results.projects.length} совпадений</p>
                </div>
              </div>
              <div className="search-page-list">
                {results.projects.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="search-page-result">
                    <span className="search-result-icon"><Icon name="folder" size={18} /></span>
                    <span className="search-page-result-body">
                      <strong>{project.name}</strong>
                      <small>{project.description || "Без описания"}</small>
                    </span>
                    <span className="search-page-result-meta">
                      <span className="muted-small">до {formatDate(project.due_date)}</span>
                      <Icon name="chevronRight" size={16} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {results.tasks.length ? (
            <section className="card search-page-group">
              <div className="card-head">
                <div>
                  <h2>Задачи</h2>
                  <p>{results.tasks.length} совпадений</p>
                </div>
              </div>
              <div className="search-page-list">
                {results.tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="search-page-result"
                    onClick={() => openTask(task.id)}
                  >
                    <span className="search-result-icon"><Icon name="tasks" size={18} /></span>
                    <span className="search-page-result-body">
                      <strong><span className="task-code">{task.code}</span> {task.title}</strong>
                      <small>{task.project_name} · {task.assignee_name || "Без исполнителя"} · до {formatDate(task.due_date)}</small>
                    </span>
                    <span className="search-page-result-meta">
                      <PriorityBadge priority={task.priority} withLabel={false} />
                      <StatusBadge status={task.status} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {results.users.length ? (
            <section className="card search-page-group">
              <div className="card-head">
                <div>
                  <h2>Сотрудники</h2>
                  <p>{results.users.length} совпадений</p>
                </div>
              </div>
              <div className="search-page-list">
                {results.users.map((user) => (
                  <Link key={user.id} to={`/team?employee=${user.id}`} className="search-page-result">
                    <Avatar user={user} size={36} />
                    <span className="search-page-result-body">
                      <strong>{user.first_name} {user.last_name}</strong>
                      <small>{user.position || "Сотрудник"} · {user.email}</small>
                    </span>
                    <span className="search-page-result-meta">
                      <Icon name="chevronRight" size={16} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
