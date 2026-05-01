import { Sparkles, Award, Clock, Heart, Shield, Star } from 'lucide-react'

type Differential = {
  icon?: string
  title: string
  text: string
}

type Props = {
  items: Differential[] | null
}

const ICONS = {
  sparkles: Sparkles,
  award: Award,
  clock: Clock,
  heart: Heart,
  shield: Shield,
  star: Star,
} as const

export function DifferentialsBlock({ items }: Props) {
  const list = items ?? []
  if (list.length === 0) return null
  return (
    <section className="-mx-4 bg-bg-subtle px-6 py-16 sm:-mx-6 sm:px-10 sm:py-20">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
        Por que escolher
      </p>
      <h2 className="mt-3 max-w-xl font-display text-[2rem] font-medium leading-[1] tracking-tight text-fg sm:text-[2.75rem]">
        Detalhes que <span className="font-light italic text-brand-accent">fazem diferença</span>
      </h2>
      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((d, i) => {
          const Icon = (d.icon && ICONS[d.icon as keyof typeof ICONS]) || Sparkles
          return (
            <li
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
              </span>
              {d.title ? (
                <h3 className="mt-1 font-display text-[1.125rem] font-medium leading-tight text-fg sm:text-[1.25rem]">
                  {d.title}
                </h3>
              ) : null}
              {d.text ? (
                <p className="text-[0.9375rem] leading-relaxed text-fg-muted">{d.text}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export const DIFFERENTIAL_ICONS = Object.keys(ICONS) as Array<keyof typeof ICONS>
