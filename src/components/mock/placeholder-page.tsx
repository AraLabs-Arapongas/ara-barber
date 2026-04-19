'use client'

import Link from 'next/link'
import { ChevronLeft, Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  title: string
  eyebrow?: string
  description?: string
  backHref?: string
  backLabel?: string
}

export function PlaceholderPage({
  title,
  eyebrow,
  description,
  backHref = '/salon/dashboard/mais',
  backLabel = 'Voltar',
}: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <header className="mb-6">
        {eyebrow ? (
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[0.875rem] text-fg-muted">{description}</p>
        ) : null}
      </header>

      <Card className="shadow-xs">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Construction className="h-10 w-10 text-fg-subtle" aria-hidden="true" />
          <p className="text-[0.9375rem] text-fg-muted">
            Tela em construção. Volta logo.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
