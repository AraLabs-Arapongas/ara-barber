export default function MeusAgendamentosLoading() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <div className="mb-5 h-11 animate-pulse rounded-md bg-bg-subtle" />
      <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-bg-subtle" />
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="h-[120px] animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </ul>
    </main>
  )
}
