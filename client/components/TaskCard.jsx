import Icon from "../icons.jsx";
import { Avatar, PriorityBadge, StatusBadge } from "../ui.jsx";
import { STATUSES } from "../constants.js";
import { dueMeta, isTaskOverdue } from "../utils.js";

export default function TaskCard({
  task,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  showStatus = false,
  onStatusChange,
  canMove = false,
  compact = false,
}) {
  const due = dueMeta(task);
  const overdue = isTaskOverdue(task);

  return (
    <article
      className={`task-card ${overdue ? "task-card-overdue" : ""} ${compact ? "task-card-compact" : ""}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(task.id));
        onDragStart?.(task);
      }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (event.target.closest("select, button, a")) return;
        onOpen?.(task.id);
      }}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.target.closest("select")) onOpen?.(task.id);
      }}
    >
      <div className="task-card-top">
        <span className="task-code">{task.code}</span>
        <div className="task-card-marks">
          {task.attachments_count > 0 ? (
            <span className="task-mark" title="Есть вложения">
              <Icon name="paperclip" size={14} />
            </span>
          ) : null}
          <PriorityBadge priority={task.priority} withLabel={false} />
        </div>
      </div>

      <h3 className="task-card-title">{task.title}</h3>

      {task.tags?.length ? (
        <div className="task-tags">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {task.tags.length > 3 ? <span className="tag tag-more">+{task.tags.length - 3}</span> : null}
        </div>
      ) : null}

      <div className="task-card-meta">
        <span className={`task-due tone-${due.tone}`}>
          <Icon name="calendar" size={14} />
          {due.text}
        </span>
        <span className="task-comments" title="Комментарии">
          <Icon name="comment" size={14} />
          {task.comments_count || 0}
        </span>
      </div>

      <div className="task-card-foot">
        <div className="task-assignee">
          {task.assignee_id ? (
            <>
              <Avatar
                name={task.assignee_name}
                src={task.assignee_avatar}
                size={24}
              />
              <span>{task.assignee_name}</span>
            </>
          ) : (
            <span className="muted-small">Не назначен</span>
          )}
        </div>

        {showStatus && onStatusChange ? (
          <select
            className={`mini-select status-select-${task.status}`}
            value={task.status}
            disabled={!canMove}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onStatusChange(task, event.target.value)}
            title={canMove ? "Изменить статус" : "Нет прав на изменение статуса"}
          >
            {STATUSES.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        ) : (
          <StatusBadge status={task.status} />
        )}
      </div>
    </article>
  );
}
