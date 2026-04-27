'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, CalendarDays, Link2, Ban } from 'lucide-react'
import { copyToClipboard } from '@/lib/clipboard'

export function QuickActions({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const ok = await copyToClipboard(publicUrl)
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const baseClass =
    'flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.875rem] font-medium text-fg shadow-xs transition-colors hover:bg-bg-subtle'

  return (
    <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Link href="/admin/dashboard/agenda/novo" className={baseClass}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Novo agendamento
      </Link>
      <Link href="/admin/dashboard/agenda" className={baseClass}>
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        Abrir agenda
      </Link>
      <button type="button" onClick={copyLink} className={baseClass} aria-live="polite">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
      <Link href="/admin/dashboard/bloqueios?new=1" className={baseClass}>
        <Ban className="h-4 w-4" aria-hidden="true" />
        Bloquear horário
      </Link>
    </div>
  )
}
