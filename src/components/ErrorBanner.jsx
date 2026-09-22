import { useState } from 'react'
import { ApiError } from '../lib/apiError'

const CODE_COPY = {
  OFFLINE: { title: "You're offline" },
  NETWORK_ERROR: { title: "Can't reach the backend" },
  TIMEOUT: { title: 'That took too long' },
  AUTH_MISSING_KEY: { title: 'Access key needed' },
  AUTH_INVALID_KEY: { title: 'Access key rejected' },
  AUTH_NOT_CONFIGURED: { title: 'Backend not configured' },
  RATE_LIMITED: { title: 'Slow down a moment' },
  VALIDATION_ERROR: { title: 'Check the form' },
}

/**
 * A single consistent way to show something going wrong: what happened, what
 * to do about it (the backend's `hint`, when there is one), an optional
 * Retry button, and — for anything worth escalating — the reference ID to
 * quote to whoever maintains this tool. Never renders a raw error object.
 */
export default function ErrorBanner({ error, onRetry, onDismiss }) {
  const [copied, setCopied] = useState(false)
  if (!error) return null

  const isApiError = error instanceof ApiError
  const code = isApiError ? error.code : null
  const title = (code && CODE_COPY[code]?.title) || 'Something went wrong'
  const message = isApiError ? error.message : (error?.message || String(error))
  const hint = isApiError ? error.hint : null
  const requestId = isApiError ? error.requestId : null
  const canRetry = onRetry && (!isApiError || error.retryable)

  function copyDetails() {
    const lines = [title, message, hint, requestId ? `Reference: ${requestId}` : null].filter(Boolean)
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <div className="error-banner-body">
        <div className="error-banner-title">{title}</div>
        <div className="error-banner-message">{message}</div>
        {hint && <div className="error-banner-hint">{hint}</div>}
        {requestId && (
          <div className="error-banner-ref">
            Reference: <code>{requestId}</code>
            <button type="button" className="inline-link-btn" onClick={copyDetails}>
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </div>
        )}
      </div>
      <div className="error-banner-actions">
        {canRetry && <button type="button" className="error-banner-btn" onClick={onRetry}>Try again</button>}
        {onDismiss && <button type="button" className="error-banner-btn error-banner-btn-quiet" onClick={onDismiss} aria-label="Dismiss">Dismiss</button>}
      </div>
    </div>
  )
}

/** Field-level message under an input, from an ApiError's `fields` list. */
export function fieldError(error, fieldName) {
  if (!(error instanceof ApiError) || !error.fields) return null
  const f = error.fields.find((f) => f.field === fieldName)
  return f ? f.message : null
}
