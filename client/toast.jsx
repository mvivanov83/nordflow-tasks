import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((items) => [...items, { id, message, type }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`toast toast-${item.type}`} onClick={() => remove(item.id)}>
              <span className="toast-dot" />
              <span>{item.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast должен использоваться внутри ToastProvider");
  return context;
}
