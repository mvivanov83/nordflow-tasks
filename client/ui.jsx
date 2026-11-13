import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "./icons.jsx";
import {
  PRIORITY_MAP,
  PROJECT_STATUS_MAP,
  ROLE_MAP,
  STATUS_MAP,
} from "./constants.js";
import { avatarTone, fullName, initials } from "./utils.js";

export function Avatar({ user, name, src, size = 36, className = "" }) {
  const displayName = name || fullName(user) || "?";
  const image = src ?? user?.avatar_url;
  return (
    <span
      className={`avatar avatar-${avatarTone(displayName)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
      title={displayName}
    >
      {image ? <img src={image} alt={displayName} /> : initials(displayName)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_MAP[status];
  return (
    <span className={`badge status-badge status-${status}`}>
      <span className="badge-dot" />
      {meta?.label || status}
    </span>
  );
}

export function PriorityBadge({ priority, withLabel = true }) {
  const meta = PRIORITY_MAP[priority];
  return (
    <span className={`badge priority-badge priority-${priority}`}>
      <span className="priority-mark" />
      {withLabel ? meta?.label || priority : null}
    </span>
  );
}

export function ProjectStatusBadge({ status }) {
  const meta = PROJECT_STATUS_MAP[status];
  return (
    <span className={`badge project-status project-status-${status}`}>
      <span className="badge-dot" />
      {meta?.label || status}
    </span>
  );
}

export function RoleBadge({ role }) {
  return <span className={`badge role-badge role-${role}`}>{ROLE_MAP[role]?.label || role}</span>;
}

export function Spinner({ size = 20, className = "" }) {
  return <span className={`spinner ${className}`} style={{ width: size, height: size }} />;
}

export function PageLoader({ label = "Загружаем данные…" }) {
  return (
    <div className="page-loader">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "tasks", title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = "accent", label }) {
  return (
    <div className="progress-wrap" title={label}>
      <div className="progress">
        <span
          className={`progress-fill progress-${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      {label ? <span className="progress-label">{label}</span> : null}
    </div>
  );
}

export function Modal({ open = true, title, subtitle, children, footer, onClose, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          {onClose ? (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, required, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      {label ? (
        <span className="field-label">
          {label}
          {required ? <span className="required">*</span> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function SectionTitle({ icon, children, action }) {
  return (
    <div className="section-title">
      <div className="section-title-text">
        {icon ? <Icon name={icon} size={17} /> : null}
        <h2>{children}</h2>
      </div>
      {action}
    </div>
  );
}
