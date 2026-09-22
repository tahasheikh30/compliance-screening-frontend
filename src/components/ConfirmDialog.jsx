import { useEffect, useRef } from 'react'

/**
 * A blocking confirmation modal for actions that matter (activating a Red
 * Book edition, discarding a staged upload). `children` renders inside the
 * body — used for the "I've reviewed this" checkbox + note field on activation.
 */
export default function ConfirmDialog({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel, disabled, children }) {
  const firstFieldRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    firstFieldRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="policy-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="policy-modal">
        <h2 id="confirm-dialog-title">{title}</h2>
        {body && <p>{body}</p>}
        {children}
        <div className="confirm-actions">
          <button type="button" className="submit-btn close-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            ref={firstFieldRef}
            className={`submit-btn close-btn ${danger ? 'submit-btn-danger' : ''}`}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
