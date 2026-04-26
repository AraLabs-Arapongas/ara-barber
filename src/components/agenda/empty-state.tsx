'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function AgendaEmptyState({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-6 rounded-xl border border-border bg-bg-subtle px-5 py-8 text-center">
      <p className="font-display text-[1.125rem] font-semibold text-fg">
        Nenhum agendamento neste dia.
      </p>
      <p className="mt-2 text-[0.875rem] text-fg-muted">
        Você pode adicionar um horário manualmente ou compartilhar seu link para seus
        clientes agendarem sozinhos.
      </p>
      <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link href="/admin/dashboard/agenda/novo">
          <Button>Adicionar agendamento</Button>
        </Link>
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copiado!' : 'Copiar link de agendamento'}
        </Button>
      </div>
    </div>
  )
}
