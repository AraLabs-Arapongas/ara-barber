import { Flag } from 'lucide-react'

type Props = {
  /** Quando true, mostra também a data desde quando é pioneiro. */
  showSince?: boolean
  pioneerSince?: string | null
  className?: string
}

/**
 * Selo permanente de "Pioneiro" — concedido a tenants que aderiram
 * até 31/07/2026. Componente único e idêntico em todos os lugares
 * (home pública, dashboard staff). Visual: pílula âmbar com bandeira
 * vermelha e nome em maiúsculas.
 */
export function PioneerBadge({ showSince = false, pioneerSince = null, className = '' }: Props) {
  const sinceText = formatPioneerSince(pioneerSince)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/60 dark:text-amber-100 ${className}`}
      title={sinceText ? `Pioneiro desde ${sinceText}` : 'Selo de Pioneiro'}
    >
      <Flag className="h-2.5 w-2.5 fill-red-600 text-red-600" aria-hidden="true" />
      Pioneiro
      {showSince && sinceText ? (
        <span className="font-normal opacity-70">· {sinceText}</span>
      ) : null}
    </span>
  )
}

function formatPioneerSince(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '')
}
