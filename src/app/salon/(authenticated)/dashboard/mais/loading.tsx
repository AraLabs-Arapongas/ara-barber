/**
 * Loading específico da tab Mais. Header estático; lista de links ganha skeleton
 * (na prática é quase instantâneo porque não tem query no server).
 */
export default function MaisLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Menu
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Mais
        </h1>
      </header>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-bg-subtle" />
            <div className="h-[56px] animate-pulse rounded-xl border border-border bg-surface" />
          </div>
        ))}
      </div>
    </main>
  )
}
