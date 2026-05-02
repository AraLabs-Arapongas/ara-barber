import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  eyebrow: string | null
  headlineTop: string | null
  headlineAccent: string | null
  subheadline: string | null
  /** Imagem retrato 9:16 — usada em mobile (<lg). */
  imageUrl: string | null
  /** Imagem paisagem 16:9 — usada em desktop (>=lg). Fallback pra mobile. */
  imageUrlDesktop: string | null
}

export function HeroBlock({
  eyebrow,
  headlineTop,
  headlineAccent,
  subheadline,
  imageUrl,
  imageUrlDesktop,
}: Props) {
  const eb = eyebrow?.trim() || null
  const top = headlineTop?.trim() || null
  const accent = headlineAccent?.trim() || null
  const sub = subheadline?.trim() || null
  const hasHeadline = !!(top || accent)
  const desktopSrc = imageUrlDesktop || imageUrl
  const mobileSrc = imageUrl

  return (
    <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden">
      {/* Container: portrait em mobile (80vh), 16:9 em desktop pra
          aproveitar a paisagem sem ocupar a tela toda. */}
      <div className="relative min-h-[80vh] lg:aspect-[16/9] lg:min-h-0">
        {/* Imagem mobile (portrait). Some em lg+. */}
        {mobileSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mobileSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover lg:hidden"
          />
        ) : null}
        {/* Imagem desktop (landscape). Visível só em lg+. Fallback pra mobile. */}
        {desktopSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={desktopSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 hidden h-full w-full object-cover lg:block"
          />
        ) : null}
        {/* Gradient placeholder se nenhuma imagem */}
        {!mobileSrc && !desktopSrc ? (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-brand-primary to-brand-primary/60" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/40 to-black/85 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/55 lg:to-transparent" />

        <div className="relative z-10 flex min-h-[80vh] flex-col justify-end px-6 pb-16 pt-28 sm:px-10 sm:pb-24 sm:pt-36 lg:min-h-0 lg:max-w-[55%] lg:justify-center lg:px-16 lg:py-24 xl:px-24 xl:py-28">
          {eb ? (
            <p className="mb-5 text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
              {eb}
            </p>
          ) : null}
          {hasHeadline ? (
            <h1 className="font-display text-[2.625rem] font-medium leading-[0.95] tracking-tight text-white sm:text-[4.5rem]">
              {top}
              {top && accent ? ' ' : null}
              {accent ? (
                <span className="font-light italic text-brand-accent">{accent}</span>
              ) : null}
            </h1>
          ) : null}
          {sub ? (
            <p
              className={`max-w-md text-[1rem] leading-relaxed text-white/85 sm:text-[1.125rem] ${
                hasHeadline ? 'mt-6' : ''
              }`}
            >
              {sub}
            </p>
          ) : null}
          <div className={hasHeadline || sub || eb ? 'mt-10' : ''}>
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
