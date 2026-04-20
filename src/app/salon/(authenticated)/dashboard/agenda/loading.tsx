/**
 * Loading específico da tab Agenda. Eyebrow + título estáticos; a data selecionada
 * (day switcher) e a lista de agendamentos ganham skeleton porque dependem do server.
 */
export default function AgendaLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Agenda
        </h1>
      </header>

      <div className="mb-4 h-10 animate-pulse rounded-lg bg-bg-subtle" />

      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-[68px] animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </ul>
    </main>
  )
}
