import { SearchingGlass } from '../components/GlobalLoader'

export default function Splash({ children }) {
  return (
    <main className="gate">
      <section className="sheet gate-sheet">
        <div className="gate-wait">
          <SearchingGlass size={40} />
          <p className="muted" role="status">{children}</p>
        </div>
      </section>
    </main>
  )
}
