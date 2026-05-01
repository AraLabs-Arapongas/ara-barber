import type * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

type Props = {
  instagramUrl: string | null
  facebookUrl: string | null
  tiktokUrl: string | null
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
    <section className="rounded-3xl bg-brand-primary px-6 py-10 text-center text-brand-primary-fg sm:px-10 sm:py-14">
      <h2 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
        Pronto pra agendar?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[0.9375rem] opacity-90">
        Reserve seu horário em poucos toques. Sem cadastro complicado.
      </p>
      <div className="mt-6">
        <Link href="/book" className="inline-block">
          <Button size="lg" variant="secondary">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Agendar agora
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
      {socials.length > 0 ? (
        <div className="mt-8 flex items-center justify-center gap-4">
          {socials.map(({ url, label, Icon }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
