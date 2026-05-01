import { Star, User } from 'lucide-react'
import type { LandingTestimonial } from '@/lib/landing/queries'

type Props = {
  testimonials: LandingTestimonial[]
}

export function TestimonialsBlock({ testimonials }: Props) {
  if (testimonials.length === 0) return null
  return (
    <section className="px-1">
      <header className="mb-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-accent">
          Quem indica
        </p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          O que dizem de nós
        </h2>
      </header>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible">
        {testimonials.map((t) => (
          <li
            key={t.id}
            className="flex w-[85%] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:w-auto"
          >
            <div className="flex items-center gap-1 text-brand-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill={i < t.rating ? 'currentColor' : 'none'}
                  strokeWidth={i < t.rating ? 0 : 1.5}
                />
              ))}
            </div>
            <p className="text-[0.875rem] leading-relaxed text-fg">&ldquo;{t.body}&rdquo;</p>
            <div className="mt-auto flex items-center gap-2 pt-1">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-bg-subtle">
                {t.authorPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.authorPhotoUrl}
                    alt={t.authorName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-fg-subtle">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
              </div>
              <p className="text-[0.8125rem] font-medium text-fg">{t.authorName}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
