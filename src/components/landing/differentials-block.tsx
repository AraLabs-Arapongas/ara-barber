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
    <section className="px-1">
      <header className="mb-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-accent">
          Por que escolher
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          Nossos diferenciais
        </h2>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((d, i) => {
          const Icon = (d.icon && ICONS[d.icon as keyof typeof ICONS]) || Sparkles
          return (
            <li
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                {d.title ? (
                  <h3 className="font-display text-[0.9375rem] font-semibold leading-tight text-fg">
                    {d.title}
                  </h3>
                ) : null}
                {d.text ? (
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-fg-muted">{d.text}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export const DIFFERENTIAL_ICONS = Object.keys(ICONS) as Array<keyof typeof ICONS>
