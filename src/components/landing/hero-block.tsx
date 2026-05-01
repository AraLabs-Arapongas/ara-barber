import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <section className="relative overflow-hidden rounded-3xl bg-bg-subtle">
      {imageUrl ? (
        // Imagem de fundo full-bleed dentro do card hero. <img> em vez
        // de next/image: a URL vem do Supabase Storage e pode mudar
        // por tenant; loader otimizado dá pouco ganho aqui.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div
        className={
          imageUrl
            ? 'relative z-10 bg-gradient-to-b from-black/50 via-black/40 to-black/70 px-6 py-16 text-white sm:px-10 sm:py-24'
            : 'relative z-10 px-6 py-12 sm:px-10 sm:py-20'
        }
      >
        <h1
          className={
            imageUrl
              ? 'font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-[3rem]'
              : 'font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-fg sm:text-[3rem]'
          }
        >
          {top}
          {accent ? (
            <>
              <br />
              <span className={imageUrl ? 'italic text-brand-accent' : 'italic text-brand-primary'}>
                {accent}
              </span>
              <span className="text-brand-accent">.</span>
            </>
          ) : null}
        </h1>
        {sub ? (
          <p
            className={
              imageUrl
                ? 'mt-4 max-w-md text-[0.9375rem] leading-relaxed text-white/85'
                : 'mt-4 max-w-md text-[0.9375rem] leading-relaxed text-fg-muted'
            }
          >
            {sub}
          </p>
        ) : null}
        <div className="mt-6">
          <Link href="/book" className="inline-block">
            <Button size="lg">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Agendar agora
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
