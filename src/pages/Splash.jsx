export default function Splash({ children }) {
  return (
    <main className="gate">
      <section className="sheet gate-sheet">
        <p className="muted" role="status">{children}</p>
      </section>
    </main>
  )
}
