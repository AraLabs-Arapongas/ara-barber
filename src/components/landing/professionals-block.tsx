import { User } from 'lucide-react'
import type { LandingProfessional } from '@/lib/landing/queries'

type Props = {
  professionals: LandingProfessional[]
}

export function ProfessionalsBlock({ professionals }: Props) {
  if (professionals.length === 0) return null
  return (
    <section className="px-1 sm:px-2">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
        Quem atende
      </p>
      <h2 className="mt-3 font-display text-[2rem] font-medium leading-[1] tracking-tight text-fg sm:text-[2.75rem]">
        Nossa <span className="font-light italic text-brand-accent">equipe</span>
      </h2>
      <ul className="mt-10 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 lg:grid-cols-5">
        {professionals.map((p) => (
          <li key={p.id} className="flex flex-col gap-2">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-bg-subtle">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt={p.displayName ?? p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-fg-subtle">
                  <User className="h-8 w-8" aria-hidden="true" strokeWidth={1} />
                </div>
              )}
            </div>
            <p className="text-center text-[0.8125rem] font-medium leading-tight text-fg sm:text-[0.875rem]">
              {p.displayName ?? p.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
