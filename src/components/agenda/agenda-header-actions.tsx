'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Link2, Plus } from 'lucide-react'

/**
 * 2 botões compactos pro header da Agenda — Novo agendamento + Copiar link.
 * Persistentes (aparecem com ou sem agendamentos no dia, eliminando os
 * botões duplicados do empty state).
 */
export function AgendaHeaderActions({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/admin/dashboard/agenda/novo"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-bg transition-colors hover:opacity-90"
        aria-label="Novo agendamento"
        title="Novo agendamento"
      >
        <Plus className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        aria-label={copied ? 'Link copiado!' : 'Copiar link de agendamento'}
        title={copied ? 'Copiado!' : 'Copiar link de agendamento'}
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  )
}
