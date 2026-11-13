import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  EmptyState,
  PageLoader,
  ProgressBar,
  RoleBadge,
} from "../ui.jsx";
import EmployeeModal from "../components/EmployeeModal.jsx";
import { ROLES } from "../constants.js";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";
import { plural } from "../utils.js";

function loadMeta(active) {
  if (active === 0) return { label: "Свободен", tone: "low", value: 4 };
  if (active <= 3) return { label: "Комфортная загрузка", tone: "ok", value: active * 22 };
  if (active <= 6) return { label: "Высокая загрузка", tone: "warning", value: active * 14 };
  return { label: "Перегрузка", tone: "danger", value: 100 };
}

export default function Team() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { version } = useData();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState(() => {
    const value = Number(searchParams.get("employee"));
    return value || null;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/team")
      .then((data) => {
        if (active) {
          setMembers(data.users);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    const value = Number(searchParams.get("employee"));
    if (value) setEmployeeId(value);
  }, [searchParams]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      if (role && member.role !== role) return false;
      if (!query) return true;
      return `${member.first_name} ${member.last_name} ${member.position} ${member.email}`
        .toLowerCase()
        .includes(query);
    });
  }, [members, search, role]);

  function canViewTasks(member) {
    return user.role === "admin" || user.role === "manager" || member.id === user.id;
  }

  function openEmployee(member) {
    if (!canViewTasks(member)) {
      toast("Задачи сотрудника доступны руководителю и администратору", "error");
      return;
    }
    setEmployeeId(member.id);
    const params = new URLSearchParams(searchParams);
    params.set("employee", String(member.id));
    setSearchParams(params, { replace: true });
  }

  function closeEmployee() {
    setEmployeeId(null);
    const params = new URLSearchParams(searchParams);
    params.delete("employee");
    setSearchParams(params, { replace: true });
  }

  const totalActive = members.reduce((sum, member) => sum + member.active_tasks, 0);
  const overloaded = members.filter((member) => member.active_tasks > 6).length;

  if (loading && !members.length) return <PageLoader />;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Команда</span>
          <h1>Сотрудники NordFlow</h1>
          <p className="page-subtitle">
            {members.length} {plural(members.length, ["сотрудник", "сотрудника", "сотрудников"])} ·{" "}
            {totalActive} активных задач ·{" "}
            {overloaded ? <span className="danger-text">{overloaded} с высокой загрузкой</span> : "загрузка в норме"}
          </p>
        </div>
      </div>

      <div className="filters-bar card">
        <div className="filter-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Найти сотрудника по имени, должности или почте"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-chips filter-chips-inline">
          <button type="button" className={`chip ${!role ? "active" : ""}`} onClick={() => setRole("")}>
            Все
          </button>
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${role === item.id ? "active" : ""}`}
              onClick={() => setRole(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {filtered.length ? (
        <div className="team-grid">
          {filtered.map((member) => {
            const load = loadMeta(member.active_tasks);
            return (
              <article
                key={member.id}
                className={`team-card card ${member.id === user.id ? "team-card-self" : ""}`}
                onClick={() => openEmployee(member)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") openEmployee(member);
                }}
              >
                <div className="team-card-head">
                  <Avatar user={member} size={52} />
                  <div className="team-card-name">
                    <strong>{member.first_name} {member.last_name}</strong>
                    <span>{member.position || "Сотрудник"}</span>
                  </div>
                  {member.id === user.id ? <span className="badge badge-self">Это вы</span> : null}
                </div>

                <a
                  className="team-email"
                  href={`mailto:${member.email}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {member.email}
                </a>

                <div className="team-role-row">
                  <RoleBadge role={member.role} />
                  <span className="muted-small">{member.projects_count} проектов</span>
                </div>

                <div className="team-stats">
                  <div>
                    <strong>{member.active_tasks}</strong>
                    <span>активных</span>
                  </div>
                  <div className={member.overdue_tasks ? "danger-text" : ""}>
                    <strong>{member.overdue_tasks}</strong>
                    <span>просрочено</span>
                  </div>
                  <div>
                    <strong>{member.done_tasks}</strong>
                    <span>выполнено</span>
                  </div>
                </div>

                <div className="team-load">
                  <div className="team-load-head">
                    <span>Загрузка</span>
                    <span className={`load-label load-${load.tone}`}>{load.label}</span>
                  </div>
                  <ProgressBar value={load.value} tone={load.tone} />
                </div>

                <div className="team-card-foot">
                  {canViewTasks(member) ? "Открыть активные задачи" : "Задачи доступны руководителю"}
                  <Icon name="chevronRight" size={15} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon="team"
            title="Сотрудники не найдены"
            text="Измените поисковый запрос или фильтр по роли."
            action={
              <button type="button" className="btn btn-secondary" onClick={() => { setSearch(""); setRole(""); }}>
                Сбросить
              </button>
            }
          />
        </div>
      )}

      {employeeId ? (
        <EmployeeModal userId={employeeId} onClose={closeEmployee} />
      ) : null}
    </div>
  );
}
