export default function AppointmentDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 sm:px-6">
      <div className="mb-4 h-4 w-28 animate-pulse rounded bg-bg-subtle" />

      <header className="mb-6">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-bg-subtle" />
        <div className="mb-2 h-8 w-4/5 animate-pulse rounded bg-bg-subtle" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-bg-subtle" />
      </header>

      <div className="mb-4 space-y-3 rounded-xl border border-border bg-surface p-4 shadow-xs">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-bg-subtle" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-bg-subtle" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-bg-subtle" />
            </div>
          </div>
        ))}
      </div>

      <div className="h-11 w-full animate-pulse rounded-md bg-bg-subtle" />
    </main>
  )
}
