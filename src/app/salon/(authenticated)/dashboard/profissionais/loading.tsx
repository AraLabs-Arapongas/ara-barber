/**
 * Loading específico da tab Equipe. Header é estático por tab, então renderiza
 * o texto real em vez de skeleton — só a lista ganha placeholder.
 */
export default function ProfessionalsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Equipe
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Profissionais
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">Quem atende no seu salão.</p>
      </header>

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
