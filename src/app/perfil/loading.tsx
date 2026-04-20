export default function PerfilLoading() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-bg-subtle" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-bg-subtle" />
          <div className="h-3 w-48 animate-pulse rounded bg-bg-subtle" />
        </div>
      </div>
      <div className="mt-8 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[3.25rem] animate-pulse rounded-lg bg-bg-subtle"
          />
        ))}
      </div>
    </main>
  )
}
