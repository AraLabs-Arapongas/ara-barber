import { Star, User } from 'lucide-react'
import type { LandingTestimonial } from '@/lib/landing/queries'

type Props = {
  testimonials: LandingTestimonial[]
}

export function TestimonialsBlock({ testimonials }: Props) {
  if (testimonials.length === 0) return null
  return (
    <section className="-mx-4 bg-bg-subtle px-6 py-16 sm:-mx-6 sm:px-10 sm:py-20">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
        Quem indica
      </p>
      <h2 className="mt-3 max-w-xl font-display text-[2rem] font-medium leading-[1] tracking-tight text-fg sm:text-[2.75rem]">
        O que <span className="font-light italic text-brand-accent">dizem</span> de nós
      </h2>
      <ul className="mt-10 -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 sm:-mx-10 sm:gap-8 sm:px-10">
        {testimonials.map((t) => (
          <li
            key={t.id}
            className="flex w-[82%] shrink-0 snap-start flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:w-[55%] md:w-[42%]"
          >
            <div className="flex items-center gap-1 text-brand-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                  fill={i < t.rating ? 'currentColor' : 'none'}
                  strokeWidth={i < t.rating ? 0 : 1.5}
                />
              ))}
            </div>
            <p className="font-display text-[1.125rem] font-light italic leading-relaxed text-fg sm:text-[1.375rem]">
              &ldquo;{t.body}&rdquo;
            </p>
            <div className="mt-auto flex items-center gap-3 pt-2">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-surface">
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
              <p className="text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-fg">
                {t.authorName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
