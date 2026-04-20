/**
 * Skeleton que aparece ao trocar de tab dentro do /dashboard. O boundary pai
 * em (authenticated)/loading.tsx não dispara em navegação entre irmãos, por
 * isso existe um específico aqui — feedback visual imediato até o RSC da
 * nova rota chegar.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-bg-subtle" />
        <div className="h-7 w-40 animate-pulse rounded bg-bg-subtle" />
        <div className="h-4 w-56 animate-pulse rounded bg-bg-subtle" />
      </div>

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
