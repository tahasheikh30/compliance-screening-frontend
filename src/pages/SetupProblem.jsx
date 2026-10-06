import { MagnifyingGlassIcon } from '../components/ui'

/** The app was built without what it needs to reach the backend or Supabase. Say exactly what. */
export default function SetupProblem({ problems }) {
  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="setup-heading">
        <div className="folder-tab">Setup</div>
        <h1 id="setup-heading"><MagnifyingGlassIcon size={22} /> This app is not set up yet</h1>
        <p className="lead">An administrator needs to fix the following in the frontend's environment settings, then redeploy it.</p>
        <ul className="setup-list">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
    </main>
  )
}
