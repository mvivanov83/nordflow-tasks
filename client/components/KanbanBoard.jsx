import { useState } from "react";
import Icon from "../icons.jsx";
import TaskCard from "./TaskCard.jsx";
import { STATUSES } from "../constants.js";
import { sortByPriority } from "../utils.js";

export default function KanbanBoard({
  tasks,
  onOpen,
  onMove,
  canDrag,
  onAddTask,
  addLabel = "Задача",
  showStatus = false,
  onStatusChange,
}) {
  const [dragTask, setDragTask] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const grouped = Object.fromEntries(STATUSES.map((status) => [status.id, []]));
  for (const task of tasks) {
    if (!grouped[task.status]) grouped[task.status] = [];
    grouped[task.status].push(task);
  }
  for (const status of STATUSES) grouped[status.id] = sortByPriority(grouped[status.id]);

  function handleDrop(event, status) {
    event.preventDefault();
    setOverColumn(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    const task = tasks.find((item) => item.id === id) || dragTask;
    setDragTask(null);
    if (!task || task.status === status) return;
    if (canDrag && !canDrag(task)) return;
    onMove?.(task, status);
  }

  return (
    <div className="kanban-scroll">
      <div className="kanban">
        {STATUSES.map((status) => (
          <section
            key={status.id}
            className={`kanban-col kanban-col-${status.id} ${overColumn === status.id ? "drag-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverColumn(status.id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOverColumn(null);
            }}
            onDrop={(event) => handleDrop(event, status.id)}
          >
            <header className="kanban-head">
              <div className="kanban-head-title">
                <span className="status-dot" />
                <h3>{status.label}</h3>
                <span className="kanban-count">{grouped[status.id].length}</span>
              </div>
              {onAddTask ? (
                <button
                  type="button"
                  className="icon-btn icon-btn-ghost"
                  title={`Добавить: ${status.label}`}
                  onClick={() => onAddTask(status.id)}
                >
                  <Icon name="plus" size={17} />
                </button>
              ) : null}
            </header>

            <div className="kanban-body">
              {grouped[status.id].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={onOpen}
                  showStatus={showStatus}
                  onStatusChange={onStatusChange}
                  canMove={canDrag ? canDrag(task) : false}
                  draggable={canDrag ? canDrag(task) : false}
                  onDragStart={setDragTask}
                  onDragEnd={() => {
                    setDragTask(null);
                    setOverColumn(null);
                  }}
                />
              ))}
              {!grouped[status.id].length ? (
                <div className="kanban-empty">
                  <Icon name="tasks" size={18} />
                  <span>Нет задач</span>
                </div>
              ) : null}
            </div>

            {onAddTask ? (
              <button type="button" className="kanban-add" onClick={() => onAddTask(status.id)}>
                <Icon name="plus" size={15} />
                Добавить
              </button>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
