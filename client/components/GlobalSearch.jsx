import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import { Avatar, PriorityBadge, Spinner, StatusBadge } from "../ui.jsx";
import { useData } from "../data.jsx";
import { formatDate } from "../utils.js";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { openTask } = useData();

  useEffect(() => {
    const handleClick = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
        setActive(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        setResults(data);
      } catch (error) {
        if (error.name !== "AbortError") setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasResults = results && (results.projects.length || results.tasks.length || results.users.length);
  const showPanel = open && active && (query.length > 0 || hasResults);

  function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(value)}`);
    setOpen(false);
    setActive(false);
  }

  function pickTask(task) {
    openTask(task.id);
    setOpen(false);
    setActive(false);
  }

  return (
    <div className="global-search" ref={boxRef}>
      <form className="global-search-form" onSubmit={handleSubmit}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Поиск по задачам, проектам и людям"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(true);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActive(false);
              event.currentTarget.blur();
            }
          }}
          aria-label="Глобальный поиск"
        />
        {loading ? <Spinner size={16} /> : <kbd>⌘ K</kbd>}
      </form>

      {showPanel ? (
        <div className="search-popover">
          {query.trim().length < 2 ? (
            <div className="search-hint">Введите минимум 2 символа</div>
          ) : hasResults ? (
            <>
              {results.projects.length ? (
                <div className="search-group">
                  <span className="search-group-title">Проекты</span>
                  {results.projects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="search-result"
                      onClick={() => {
                        setOpen(false);
                        setActive(false);
                      }}
                    >
                      <span className="search-result-icon"><Icon name="folder" size={17} /></span>
                      <span className="search-result-text">
                        <strong>{project.name}</strong>
                        <small>{project.manager_name} · до {formatDate(project.due_date)}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              {results.tasks.length ? (
                <div className="search-group">
                  <span className="search-group-title">Задачи</span>
                  {results.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="search-result"
                      onClick={() => pickTask(task)}
                    >
                      <span className="search-result-icon"><Icon name="tasks" size={17} /></span>
                      <span className="search-result-text">
                        <strong>{task.code} · {task.title}</strong>
                        <small>{task.project_name} · {task.assignee_name || "Без исполнителя"}</small>
                      </span>
                      <span className="search-result-meta">
                        <PriorityBadge priority={task.priority} withLabel={false} />
                        <StatusBadge status={task.status} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.users.length ? (
                <div className="search-group">
                  <span className="search-group-title">Сотрудники</span>
                  {results.users.map((user) => (
                    <Link
                      key={user.id}
                      to={`/team?employee=${user.id}`}
                      className="search-result"
                      onClick={() => {
                        setOpen(false);
                        setActive(false);
                      }}
                    >
                      <Avatar user={user} size={30} />
                      <span className="search-result-text">
                        <strong>{user.first_name} {user.last_name}</strong>
                        <small>{user.position || "Сотрудник"} · {user.email}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              <Link
                to={`/search?q=${encodeURIComponent(query.trim())}`}
                className="search-all"
                onClick={() => {
                  setOpen(false);
                  setActive(false);
                }}
              >
                Показать все результаты
                <Icon name="chevronRight" size={16} />
              </Link>
            </>
          ) : (
            <div className="search-hint">
              <Icon name="search" size={18} />
              Ничего не найдено по запросу «{query.trim()}»
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
