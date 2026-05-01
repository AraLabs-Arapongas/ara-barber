import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  tenantName: string
  headlineTop: string | null
  headlineAccent: string | null
  subheadline: string | null
  imageUrl: string | null
}

export function HeroBlock({
  tenantName,
  headlineTop,
  headlineAccent,
  subheadline,
  imageUrl,
}: Props) {
  const top = headlineTop?.trim() || tenantName
  const accent = headlineAccent?.trim() || null
  const sub = subheadline?.trim() || null

  return (
    <section className="relative -mx-4 overflow-hidden sm:-mx-6">
      <div className="relative min-h-[80vh]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-brand-primary to-brand-primary/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/40 to-black/85" />

        <div className="relative z-10 flex min-h-[80vh] flex-col justify-end px-6 pb-16 pt-28 sm:px-10 sm:pb-24 sm:pt-36">
          <p className="mb-5 text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
            {tenantName}
          </p>
          <h1 className="font-display text-[2.625rem] font-medium leading-[0.95] tracking-tight text-white sm:text-[4.5rem]">
            {top}
            {accent ? (
              <>
                {' '}
                <span className="font-light italic text-brand-accent">{accent}</span>
              </>
            ) : null}
          </h1>
          {sub ? (
            <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-white/85 sm:text-[1.125rem]">
              {sub}
            </p>
          ) : null}
          <div className="mt-10">
            <Link
              href="/book"
              className="group inline-flex items-center gap-3 rounded-full bg-brand-accent px-8 py-4 text-[0.9375rem] font-medium text-brand-accent-fg shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              Agendar agora
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
