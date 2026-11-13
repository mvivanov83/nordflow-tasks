import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadFile } from "../api.js";
import Icon from "../icons.jsx";
import {
  Avatar,
  Field,
  PageLoader,
  PriorityBadge,
  Spinner,
  StatusBadge,
} from "../ui.jsx";
import {
  HISTORY_FIELD_LABELS,
  PRIORITIES,
  STATUSES,
} from "../constants.js";
import { useAuth } from "../auth.jsx";
import { useData } from "../data.jsx";
import { useToast } from "../toast.jsx";
import {
  dueMeta,
  formatDate,
  formatDateTime,
  fullName,
  timeAgo,
} from "../utils.js";

function historyText(entry) {
  if (entry.action === "created") return "создал(а) задачу";
  if (entry.action === "updated") {
    const field = HISTORY_FIELD_LABELS[entry.field] || entry.field;
    if (entry.field === "description") return "изменил(а) описание задачи";
    return (
      <>
        изменил(а) «{field}»
        {entry.old_value || entry.new_value ? (
          <span className="history-change">
            {entry.old_value || "—"} <span className="history-arrow">→</span> {entry.new_value || "—"}
          </span>
        ) : null}
      </>
    );
  }
  if (entry.action === "comment_added") return "добавил(а) комментарий";
  if (entry.action === "comment_deleted") return "удалил(а) комментарий";
  if (entry.action === "attachment_added") return `прикрепил(а) «${entry.new_value || "файл"}»`;
  if (entry.action === "attachment_removed") return `удалил(а) вложение «${entry.old_value || ""}»`;
  return entry.action;
}

export default function TaskDrawer() {
  const { taskId, closeTask } = useData();
  const { user } = useAuth();
  const { bump } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [linkForm, setLinkForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api(`/tasks/${taskId}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setData(null);
      setEditing(false);
      setLinkForm(null);
      return;
    }
    setEditing(false);
    setLinkForm(null);
    setComment("");
    load();
  }, [taskId, load]);

  useEffect(() => {
    if (!taskId) return undefined;
    api("/users")
      .then((result) => setUsers(result.users))
      .catch(() => {});
    return undefined;
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editing) setEditing(false);
        else closeTask();
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [taskId, editing, closeTask]);

  if (!taskId) return null;

  const task = data?.task;
  const permissions = data?.permissions || {};

  function startEditing() {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id || "",
      due_date: task.due_date || "",
      tags: (task.tags || []).join(", "),
    });
    setEditing(true);
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!editForm.title.trim()) {
      toast("Название задачи обязательно", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title: editForm.title,
          description: editForm.description,
          status: editForm.status,
          priority: editForm.priority,
          assignee_id: Number(editForm.assignee_id),
          due_date: editForm.due_date || null,
          tags: editForm.tags,
        },
      });
      setData((previous) => ({ ...previous, task: result.task }));
      setEditing(false);
      bump();
      toast("Задача обновлена");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status) {
    if (!task || status === task.status) return;
    setStatusSaving(true);
    try {
      const result = await api(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setData((previous) => ({ ...previous, task: result.task }));
      bump();
      toast(`Статус изменён: ${STATUSES.find((item) => item.id === status)?.label}`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setStatusSaving(false);
    }
  }

  async function addComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentSaving(true);
    try {
      await api(`/tasks/${task.id}/comments`, {
        method: "POST",
        body: { body: comment },
      });
      setComment("");
      await load();
      bump();
      toast("Комментарий добавлен");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCommentSaving(false);
    }
  }

  async function saveComment(id) {
    if (!commentDraft.trim()) return;
    try {
      await api(`/comments/${id}`, { method: "PATCH", body: { body: commentDraft } });
      setEditingComment(null);
      await load();
      toast("Комментарий обновлён");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function deleteComment(id) {
    if (!window.confirm("Удалить комментарий?")) return;
    try {
      await api(`/comments/${id}`, { method: "DELETE" });
      await load();
      bump();
      toast("Комментарий удалён");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function addLink(event) {
    event.preventDefault();
    if (!linkForm?.url?.trim()) return;
    try {
      await api(`/tasks/${task.id}/attachments/link`, {
        method: "POST",
        body: { name: linkForm.name, url: linkForm.url },
      });
      setLinkForm(null);
      await load();
      bump();
      toast("Ссылка добавлена");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function uploadAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFile(`/tasks/${task.id}/attachments/file`, file);
      await load();
      bump();
      toast("Файл прикреплён");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteAttachment(id) {
    if (!window.confirm("Удалить вложение?")) return;
    try {
      await api(`/attachments/${id}`, { method: "DELETE" });
      await load();
      bump();
      toast("Вложение удалено");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const due = task ? dueMeta(task) : null;
  const canEdit = Boolean(permissions.can_edit);
  const canMove = Boolean(permissions.can_move);
  const canDeleteAttachment =
    user.role === "admin" || permissions.can_manage_project;

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeTask();
    }}>
      <aside className="task-drawer" role="dialog" aria-modal="true" aria-label="Карточка задачи">
        <div className="drawer-top">
          <div className="drawer-breadcrumb">
            {task ? (
              <>
                <span className="task-code">{task.code}</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    navigate(`/projects/${task.project_id}`);
                  }}
                >
                  {task.project_name}
                </button>
              </>
            ) : (
              <span>Задача</span>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={closeTask} aria-label="Закрыть задачу">
            <Icon name="close" size={21} />
          </button>
        </div>

        {loading && !task ? <PageLoader /> : null}
        {error ? (
          <div className="drawer-error">
            <Icon name="alert" size={26} />
            <h3>Не удалось открыть задачу</h3>
            <p>{error}</p>
          </div>
        ) : null}

        {task ? (
          <>
            <div className="drawer-head">
              {editing ? (
                <form id="edit-task-form" onSubmit={saveTask} className="edit-task-form">
                  <Field label="Название" required>
                    <input
                      autoFocus
                      value={editForm.title}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </Field>

                  <div className="form-grid">
                    <Field label="Статус">
                      <select
                        value={editForm.status}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        {STATUSES.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Приоритет">
                      <select
                        value={editForm.priority}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, priority: event.target.value }))}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority.id} value={priority.id}>{priority.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Исполнитель">
                      <select
                        value={editForm.assignee_id}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                      >
                        <option value="">Не назначен</option>
                        {users.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Дедлайн">
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, due_date: event.target.value }))}
                      />
                    </Field>
                    <Field label="Теги" hint="Через запятую" className="span-2">
                      <input
                        value={editForm.tags}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, tags: event.target.value }))}
                      />
                    </Field>
                    <Field label="Описание" className="span-2">
                      <textarea
                        rows={6}
                        value={editForm.description}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="edit-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <Spinner size={16} /> : <Icon name="check" size={16} />}
                      Сохранить
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="drawer-title-row">
                    <h1>{task.title}</h1>
                    {canEdit ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={startEditing}>
                        <Icon name="edit" size={15} />
                        Редактировать
                      </button>
                    ) : null}
                  </div>
                  <div className="drawer-status-row">
                    {canMove ? (
                      <select
                        className="status-select"
                        value={task.status}
                        disabled={statusSaving}
                        onChange={(event) => changeStatus(event.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={task.status} />
                    )}
                    <PriorityBadge priority={task.priority} />
                    {task.tags?.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!editing ? (
              <div className="drawer-content">
                <div className="drawer-main">
                  <section className="drawer-section">
                    <h3>Описание</h3>
                    {task.description ? (
                      <div className="task-description">{task.description}</div>
                    ) : (
                      <p className="muted">Описание пока не добавлено.</p>
                    )}
                  </section>

                  <section className="drawer-section">
                    <div className="drawer-section-head">
                      <h3>Вложения <span className="count-pill">{task.attachments?.length || 0}</span></h3>
                      <div className="attachment-actions">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setLinkForm((value) => (value ? null : { name: "", url: "" }))}
                        >
                          <Icon name="link" size={14} />
                          Ссылка
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Spinner size={14} /> : <Icon name="upload" size={14} />}
                          Файл
                        </button>
                        <input ref={fileRef} type="file" hidden onChange={uploadAttachment} />
                      </div>
                    </div>

                    {linkForm ? (
                      <form className="link-form" onSubmit={addLink}>
                        <input
                          placeholder="Название (необязательно)"
                          value={linkForm.name}
                          onChange={(event) => setLinkForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                          placeholder="https://…"
                          value={linkForm.url}
                          onChange={(event) => setLinkForm((prev) => ({ ...prev, url: event.target.value }))}
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Добавить</button>
                      </form>
                    ) : null}

                    {task.attachments?.length ? (
                      <div className="attachment-list">
                        {task.attachments.map((attachment) => {
                          const canDelete =
                            canDeleteAttachment || attachment.user_id === user.id;
                          return (
                            <div key={attachment.id} className="attachment-item">
                              <span className="attachment-icon">
                                <Icon name={attachment.kind === "file" ? "file" : "link"} size={17} />
                              </span>
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="attachment-name"
                              >
                                {attachment.name}
                                <small>
                                  {attachment.kind === "file"
                                    ? `${Math.max(1, Math.round((attachment.size || 0) / 1024))} КБ`
                                    : "Ссылка"}
                                  {attachment.author_name ? ` · ${attachment.author_name}` : ""}
                                </small>
                              </a>
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="icon-btn icon-btn-ghost danger-text"
                                  onClick={() => deleteAttachment(attachment.id)}
                                  title="Удалить вложение"
                                >
                                  <Icon name="trash" size={15} />
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">Файлы и ссылки не прикреплены.</p>
                    )}
                  </section>

                  <section className="drawer-section">
                    <h3>Комментарии <span className="count-pill">{task.comments?.length || 0}</span></h3>

                    <form className="comment-form" onSubmit={addComment}>
                      <Avatar user={user} size={34} />
                      <div className="comment-form-body">
                        <textarea
                          rows={3}
                          placeholder="Написать комментарий…"
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                        />
                        <div className="comment-form-actions">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={commentSaving || !comment.trim()}>
                            {commentSaving ? <Spinner size={14} /> : null}
                            Отправить
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="comment-list">
                      {task.comments?.map((item) => (
                        <div key={item.id} className="comment-item">
                          <Avatar
                            name={item.author_name}
                            src={item.author_avatar}
                            size={34}
                          />
                          <div className="comment-body">
                            <div className="comment-head">
                              <strong>{item.author_name}</strong>
                              <span>{formatDateTime(item.created_at)}</span>
                              {item.updated_at && item.updated_at !== item.created_at ? (
                                <span className="edited-mark">изменён</span>
                              ) : null}
                              <div className="comment-actions">
                                {item.user_id === user.id ? (
                                  <button
                                    type="button"
                                    className="link-btn"
                                    onClick={() => {
                                      setEditingComment(item.id);
                                      setCommentDraft(item.body);
                                    }}
                                  >
                                    Изменить
                                  </button>
                                ) : null}
                                {item.user_id === user.id || user.role === "admin" ? (
                                  <button
                                    type="button"
                                    className="link-btn danger-text"
                                    onClick={() => deleteComment(item.id)}
                                  >
                                    Удалить
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {editingComment === item.id ? (
                              <div className="comment-edit">
                                <textarea
                                  rows={3}
                                  value={commentDraft}
                                  onChange={(event) => setCommentDraft(event.target.value)}
                                  autoFocus
                                />
                                <div className="comment-form-actions">
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingComment(null)}>
                                    Отмена
                                  </button>
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => saveComment(item.id)}>
                                    Сохранить
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="comment-text">{item.body}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {!task.comments?.length ? (
                        <p className="muted">Комментариев пока нет. Начните обсуждение первым.</p>
                      ) : null}
                    </div>
                  </section>

                  <section className="drawer-section">
                    <h3>История изменений</h3>
                    <div className="history-list">
                      {task.history?.map((entry) => (
                        <div key={entry.id} className="history-item">
                          <Avatar name={entry.actor_name || "Система"} src={entry.actor_avatar} size={26} />
                          <div className="history-body">
                            <p>
                              <strong>{entry.actor_name || "Система"}</strong>{" "}
                              {historyText(entry)}
                            </p>
                            <span>{timeAgo(entry.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <aside className="drawer-side">
                  <div className="side-block">
                    <h4>Детали</h4>
                    <div className="detail-row">
                      <span>Проект</span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => navigate(`/projects/${task.project_id}`)}
                      >
                        {task.project_name}
                      </button>
                    </div>
                    <div className="detail-row">
                      <span>Исполнитель</span>
                      {task.assignee_name ? (
                        <span className="detail-user">
                          <Avatar name={task.assignee_name} src={task.assignee_avatar} size={24} />
                          {task.assignee_name}
                        </span>
                      ) : (
                        <span className="muted">Не назначен</span>
                      )}
                    </div>
                    <div className="detail-row">
                      <span>Постановщик</span>
                      <span className="detail-user">
                        <Avatar name={task.reporter_name} src={task.reporter_avatar} size={24} />
                        {task.reporter_name}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span>Приоритет</span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <div className="detail-row">
                      <span>Дедлайн</span>
                      <span className={`tone-${due.tone}`}>{due.text}</span>
                    </div>
                    <div className="detail-row">
                      <span>Создана</span>
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Обновлена</span>
                      <span>{formatDateTime(task.updated_at)}</span>
                    </div>
                  </div>

                  <div className="side-block side-block-muted">
                    <h4>Идентификатор</h4>
                    <span className="task-code-large">{task.code}</span>
                    <p className="muted-small">Проект «{task.project_name}»</p>
                  </div>
                </aside>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
