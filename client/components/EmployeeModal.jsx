import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Avatar, EmptyState, Modal, PageLoader, PriorityBadge, StatusBadge } from "../ui.jsx";
import { ROLE_MAP } from "../constants.js";
import { dueMeta } from "../utils.js";
import { useData } from "../data.jsx";

export default function EmployeeModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { openTask } = useData();

  useEffect(() => {
    let active = true;
    api(`/team/${userId}/tasks`)
      .then((result) => {
        if (active) setData(result);
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
  }, [userId]);

  const user = data?.user;

  return (
    <Modal open title="Карточка сотрудника" onClose={onClose} size="md">
      {loading ? <PageLoader label="Загружаем сотрудника…" /> : null}
      {error ? <div className="form-error">{error}</div> : null}
      {user ? (
        <>
          <div className="employee-modal-head">
            <Avatar user={user} size={64} />
            <div>
              <h3>{user.first_name} {user.last_name}</h3>
              <p>{user.position || "Сотрудник"}</p>
              <span className="badge role-badge">{ROLE_MAP[user.role]?.label}</span>
            </div>
          </div>
          <div className="employee-contact">
            <span>Почта</span>
            <a href={`mailto:${user.email}`}>{user.email}</a>
          </div>
          <div className="employee-tasks-head">
            <h4>Активные задачи · {data.tasks.length}</h4>
          </div>
          {data.tasks.length ? (
            <div className="employee-tasks">
              {data.tasks.map((task) => {
                const due = dueMeta(task);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`employee-task ${task.is_overdue ? "overdue" : ""}`}
                    onClick={() => {
                      onClose();
                      openTask(task.id);
                    }}
                  >
                    <div className="employee-task-top">
                      <span className="task-code">{task.code}</span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <strong>{task.title}</strong>
                    <div className="employee-task-meta">
                      <span>{task.project_name}</span>
                      <span className={`tone-${due.tone}`}>{due.text}</span>
                      <StatusBadge status={task.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="check" title="Активных задач нет" text="Все задачи сотрудника завершены." />
          )}
        </>
      ) : null}
    </Modal>
  );
}
