/**
 * Loading da home (tab Início). Eyebrow "Hoje" é estático; a data do header
 * depende do timezone do tenant, então fica skeleton. Stat cards e ações rápidas
 * também ganham placeholder.
 */
export default function DashboardHomeLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Hoje
        </p>
        <div className="mt-1 h-8 w-56 animate-pulse rounded bg-bg-subtle" />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="h-[112px] animate-pulse rounded-xl border border-border bg-surface" />
        <div className="h-[112px] animate-pulse rounded-xl border border-border bg-surface" />
      </div>

      <div className="mt-4 flex gap-2">
        <div className="h-12 flex-1 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-12 flex-1 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    </main>
  )
}
