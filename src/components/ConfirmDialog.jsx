import { useEffect, useRef } from "react";

/**
 * A blocking confirmation modal for actions that matter (removing someone's access, granting admin rights).
 * Keyboard friendly: Escape cancels, Tab stays inside the dialog, and focus returns to where it was. For a
 * destructive action focus starts on Cancel, so a stray Enter does not confirm it.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
  disabled,
  children,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const before = document.activeElement;
    (danger ? cancelRef : confirmRef).current?.focus();
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Tab") {
        const items = dialogRef.current?.querySelectorAll(
          'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
        );
        const list = items
          ? Array.from(items).filter((el) => !el.disabled)
          : [];
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      before?.focus?.();
    };
  }, [onCancel, danger]);

  return (
    <div
      className="policy-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="policy-modal" ref={dialogRef}>
        <h2 id="confirm-dialog-title">{title}</h2>
        {body && <p>{body}</p>}
        {children}
        <div className="confirm-actions">
          <button
            type="button"
            ref={cancelRef}
            className="btn btn-quiet"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
