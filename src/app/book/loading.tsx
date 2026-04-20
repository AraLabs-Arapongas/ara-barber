export default function BookLoading() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <div className="mb-4 flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 animate-pulse rounded-full bg-bg-subtle"
          />
        ))}
      </div>
      <div className="mb-5 h-8 w-60 animate-pulse rounded-lg bg-bg-subtle" />
      <div className="mb-5 h-4 w-80 animate-pulse rounded bg-bg-subtle" />
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="h-[76px] animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </ul>
    </main>
  )
}
