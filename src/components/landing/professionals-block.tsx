import type { LandingProfessional } from '@/lib/landing/queries'

type Props = {
  professionals: LandingProfessional[]
}

/** "DR" pra "Diogo Reis", "M" pra "Marcus" — até 2 letras, uppercase. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
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
        {professionals.map((p) => {
          const display = p.displayName ?? p.name
          return (
            <li key={p.id} className="flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-primary text-brand-primary-fg">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={display} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-[1.75rem] font-semibold sm:text-[2rem]">
                    {initialsOf(display)}
                  </div>
                )}
              </div>
              <p className="text-center text-[0.8125rem] font-medium leading-tight text-fg sm:text-[0.875rem]">
                {display}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
