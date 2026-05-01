import { User } from 'lucide-react'
import type { LandingProfessional } from '@/lib/landing/queries'

type Props = {
  professionals: LandingProfessional[]
}

export function ProfessionalsBlock({ professionals }: Props) {
  if (professionals.length === 0) return null
  return (
    <section className="px-1">
      <header className="mb-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-accent">
          Quem atende
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          Nossa equipe
        </h2>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {professionals.map((p) => (
          <li
            key={p.id}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center"
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-bg-subtle">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt={p.displayName ?? p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-fg-subtle">
                  <User className="h-8 w-8" aria-hidden="true" />
                </div>
              )}
            </div>
            <p className="text-[0.875rem] font-medium leading-tight text-fg">
              {p.displayName ?? p.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
