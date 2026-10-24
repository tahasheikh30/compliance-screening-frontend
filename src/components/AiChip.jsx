import { useAiStatus } from '../lib/ai'

/**
 * Says whether AI search is helping. When an administrator has it off the person is told so, plainly, and that
 * screening works exactly the same without it.
 */
export default function AiChip() {
  const status = useAiStatus()
  if (!status) return null
  const on = status.state === 'on'
  const text = on ? 'AI search is on' : status.state === 'paused' ? 'AI search is resting' : 'AI search is off'
  const title = on
    ? 'AI adds labelled leads and reads near matches. It never clears anyone on its own.'
    : status.state === 'unconfigured'
      ? 'AI search is not set up on this server. Screening works as usual.'
      : 'Screening works as usual without it.'
  return (
    <span className={`ai-chip ${on ? 'ai-chip-on' : 'ai-chip-off'}`} title={title} role="status">
      <span className="ai-chip-dot" aria-hidden="true" />{text}
    </span>
  )
}
