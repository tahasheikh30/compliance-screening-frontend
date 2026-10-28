import { useAuth } from '../auth/AuthContext'
import ErrorBanner from '../components/ErrorBanner'
import { MagnifyingGlassIcon } from '../components/ui'

/** Signed in, and the backend has not answered yet (often just a slow first connection). */
export default function Connecting() {
  const { meError, refresh, signOut } = useAuth()
  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="connect-heading">
        <h1 id="connect-heading"><MagnifyingGlassIcon size={22} /> Connecting to the server</h1>
        <p className="lead" role="status">
          {meError ? 'The server did not answer.' : 'Signing you in. This can take up to a minute the first time.'}
        </p>
        <ErrorBanner error={meError} onRetry={refresh} />
        <div className="form-actions"><button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button></div>
      </section>
    </main>
  )
}
