/**
 * Loading UI pro segmento autenticado. Next 16 mostra esse skeleton
 * imediatamente ao navegar entre tabs enquanto o RSC da nova rota é buscado,
 * cortando a sensação de "clique sem feedback".
 */
export default function AdminLoading() {
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
