import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  section: string
  title: string
  description: string
}

/**
 * Placeholder pra seções que estão fora do escopo do piloto (Spec 1).
 * Mantém a navegação consistente sem levar a UIs quebradas/mockadas.
 */
export function OutOfPilotStub({ section, title, description }: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          {section}
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {title}
        </h1>
      </header>

      <Card className="shadow-xs">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="font-display text-[1.125rem] font-semibold text-fg">
            Em breve
          </h2>
          <p className="max-w-sm text-[0.875rem] text-fg-muted">{description}</p>
        </CardContent>
      </Card>
    </main>
  )
}
