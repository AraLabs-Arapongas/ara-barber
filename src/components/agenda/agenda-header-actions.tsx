'use client'

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { copyToClipboard } from '@/lib/clipboard'

/**
 * Botão "Copiar link" do header da Agenda. O "Novo agendamento"
 * virou Button labeled abaixo do título (padrão dos outros headers
 * — ver Profissionais, Serviços).
 */
export function AgendaHeaderActions({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const ok = await copyToClipboard(publicUrl)
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
      aria-label={copied ? 'Link copiado!' : 'Copiar link de agendamento'}
      title={copied ? 'Copiado!' : 'Copiar link de agendamento'}
    >
      <Link2 className="h-4 w-4" />
    </button>
  )
}
