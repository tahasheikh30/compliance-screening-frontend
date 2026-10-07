import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Toasts (the small messages that appear and fade away) and the notification list behind them.
 *
 *   const toast = useToast()
 *   toast.success('Password changed')
 *   toast.error('Screening failed', { message: 'The server did not answer.', to: 'history' })
 *
 * Every toast is also kept in a notification list, so something that happened while the person was on
 * another tab can still be read later. The profile menu shows a red dot while any are unread.
 *
 * Privacy: notifications live in memory only. They are never written to localStorage, because a
 * message such as "Screening complete: <applicant name>" is applicant PII. A reload clears them.
 *
 * Outside a provider (a component rendered on its own, as in tests) every call quietly does nothing.
 *
 * No library: the Content Security Policy and the "no third-party code that touches PII" rule both argue
 * for keeping this small and in the repo.
 */

const ToastContext = createContext(null);

const NOOP_TOAST = {
  success() {},
  error() {},
  warn() {},
  info() {},
  dismiss() {},
};
const NOOP = {
  toast: NOOP_TOAST,
  notifications: [],
  unread: 0,
  markAllRead() {},
  clearAll() {},
};

const MAX_VISIBLE = 4;
const MAX_LOGGED = 50;
const DURATION = { success: 4000, info: 4500, warn: 6000, error: 7000 };

export function useToast() {
  return (useContext(ToastContext) || NOOP).toast;
}

export function useNotifications() {
  return useContext(ToastContext) || NOOP;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback((tone, title, opts = {}) => {
    const { message = "", to = null, log = true, duration } = opts;
    const id = nextId.current++;
    setToasts((all) => {
      // the same message twice in a row (a poll that keeps finding the same thing) is shown once
      if (
        all.some(
          (t) => t.title === title && t.message === message && !t.leaving,
        )
      )
        return all;
      return [
        ...all,
        { id, tone, title, message, duration: duration ?? DURATION[tone] },
      ].slice(-MAX_VISIBLE);
    });
    if (log) {
      setNotifications((all) =>
        [
          { id, tone, title, message, to, at: new Date(), read: false },
          ...all,
        ].slice(0, MAX_LOGGED),
      );
    }
    return id;
  }, []);

  const toast = useMemo(
    () => ({
      success: (title, opts) => push("success", title, opts),
      error: (title, opts) => push("error", title, opts),
      warn: (title, opts) => push("warn", title, opts),
      info: (title, opts) => push("info", title, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  const markAllRead = useCallback(() => {
    setNotifications((all) =>
      all.some((n) => !n.read) ? all.map((n) => ({ ...n, read: true })) : all,
    );
  }, []);
  const clearAll = useCallback(() => setNotifications([]), []);

  const unread = notifications.filter((n) => !n.read).length;
  const value = useMemo(
    () => ({ toast, notifications, unread, markAllRead, clearAll }),
    [toast, notifications, unread, markAllRead, clearAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: <path d="M5 12.5l4.2 4.2L19 7" />,
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5v.01" />
    </>
  ),
};

export function ToneIcon({ tone, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[tone] || ICONS.info}
    </svg>
  );
}

function Toast({ item, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  const left = useRef(item.duration); // time still to run when the pointer is over it
  const startedAt = useRef(0);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(item.id), 180);
  }, [item.id, onDismiss]);

  const run = useCallback(() => {
    clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = setTimeout(close, left.current);
  }, [close]);

  useEffect(() => {
    run();
    return () => clearTimeout(timer.current);
  }, [run]);

  // hovering or focusing a toast pauses it, so it can be read (and its close button reached)
  const pause = () => {
    clearTimeout(timer.current);
    left.current = Math.max(
      1200,
      left.current - (Date.now() - startedAt.current),
    );
  };

  const urgent = item.tone === "error";
  return (
    <li
      className={`toast toast-${item.tone}${leaving ? " toast-leaving" : ""}`}
      role={urgent ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={run}
      onFocus={pause}
      onBlur={run}
    >
      <span className="toast-icon">
        <ToneIcon tone={item.tone} />
      </span>
      <div className="toast-body">
        <p className="toast-title">{item.title}</p>
        {item.message && <p className="toast-message">{item.message}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss message"
        onClick={close}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}

function Toaster({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <ul className="toaster" aria-label="Messages">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}
