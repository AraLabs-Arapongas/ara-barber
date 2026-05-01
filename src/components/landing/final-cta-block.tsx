import type * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88V14.9h-2.54V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.9h-2.33v6.98C18.34 21.13 22 16.99 22 12z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.95a8.16 8.16 0 0 0 4.77 1.52V7.05a4.85 4.85 0 0 1-1.84-.36z" />
    </svg>
  )
}

export function FinalCtaBlock({ instagramUrl, facebookUrl, tiktokUrl }: Props) {
  const socials = [
    instagramUrl ? { url: instagramUrl, label: 'Instagram', Icon: InstagramIcon } : null,
    facebookUrl ? { url: facebookUrl, label: 'Facebook', Icon: FacebookIcon } : null,
    tiktokUrl ? { url: tiktokUrl, label: 'TikTok', Icon: TikTokIcon } : null,
  ].filter(
    (
      s,
    ): s is {
      url: string
      label: string
      Icon: (props: { className?: string }) => React.ReactElement
    } => s !== null,
  )

  return (
    <section className="-mx-4 bg-fg px-6 py-20 text-center sm:-mx-6 sm:px-10 sm:py-28">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-brand-accent">
        Vamos lá
      </p>
      <h2 className="mx-auto mt-4 max-w-2xl font-display text-[2.25rem] font-medium leading-[1] tracking-tight text-bg sm:text-[3.5rem]">
        Pronto pra <span className="font-light italic text-brand-accent">agendar?</span>
      </h2>
      <p className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-bg/70">
        Reserve seu horário em poucos toques. Sem cadastro complicado.
      </p>
      <div className="mt-10">
        <Link
          href="/book"
          className="group inline-flex items-center gap-3 rounded-full bg-brand-accent px-9 py-4 text-[0.9375rem] font-medium text-brand-accent-fg shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          Agendar agora
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
      {socials.length > 0 ? (
        <div className="mt-12 flex items-center justify-center gap-5">
          {socials.map(({ url, label, Icon }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-bg/30 text-bg transition-colors hover:border-brand-accent hover:text-brand-accent"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
