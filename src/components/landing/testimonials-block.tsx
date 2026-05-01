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
      {/* Letreiro horizontal: lista duplicada + animação que translada
          até -50% (uma lista inteira). Pausa no hover. Em motion-reduce
          (acessibilidade) a animação some e o conteúdo fica estático,
          permitindo scroll natural. */}
      <div
        className="group relative mt-10 -mx-6 overflow-hidden sm:-mx-10"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
        }}
      >
        <ul className="flex w-max gap-5 px-6 pb-4 motion-safe:animate-marquee-x motion-safe:group-hover:[animation-play-state:paused] sm:gap-8 sm:px-10">
          {[...testimonials, ...testimonials].map((t, idx) => (
            <li
              key={`${t.id}-${idx}`}
              aria-hidden={idx >= testimonials.length}
              className="flex w-[300px] shrink-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:w-[360px]"
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
              <p className="font-display text-[1.125rem] font-light italic leading-relaxed text-fg sm:text-[1.25rem]">
                &ldquo;{t.body}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3 pt-2">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-bg-subtle">
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
      </div>
    </section>
  )
}
