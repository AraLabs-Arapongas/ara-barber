import type { Metadata } from 'next'
import Link from 'next/link'
import { AraLabsMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: false },
}

export default function NotFoundPage() {
  return (
    <main className="noise-overlay relative flex min-h-screen flex-col bg-bg px-6 py-10">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <AraLabsMark className="mb-8 h-14 w-auto text-brand-primary" />

        <p className="mb-3 font-display text-[5rem] font-semibold leading-none tracking-tight text-fg sm:text-[6rem]">
          404
        </p>

        <h1 className="mb-3 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2.25rem]">
          Esse endereço não está <span className="italic text-brand-primary">ativo</span>
          <span className="text-brand-accent">.</span>
        </h1>

        <p className="max-w-sm text-[0.9375rem] leading-relaxed text-fg-muted">
          A página que você procurou não existe ou o endereço mudou. Confira o link ou volte pra
          raiz.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/">
            <Button size="lg" variant="primary">
              Voltar pro início
            </Button>
          </Link>
          <Link
            href="https://aralabs.com.br"
            className="text-[0.8125rem] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Conhecer a AraLabs →
          </Link>
        </div>
      </div>

      <footer className="relative z-10 text-center text-[0.75rem] text-fg-subtle">
        Ara Barber · AraLabs
      </footer>
    </main>
  )
}
