'use client'

import { useEffect, useRef, useState } from 'react'

import { STATUS_DOT, STATUS_LABELS } from '@/lib/appointments/labels'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

/**
 * Bolinha colorida indicando status do appointment, sem texto inline.
 * Tap/clique abre tooltip com o label completo. Tooltip auto-fecha em
 * 2.5s OU ao tocar fora. Acessível: botão real, aria-label, foco
 * mostra tooltip também.
 *
 * Usado em cards onde texto cheio do badge quebraria layout (ex:
 * próxima reserva na home, lista de reservas).
 */
export function StatusDot({
  status,
  size = 'md',
}: {
  status: AppointmentStatus
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-close + click-outside.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    timerRef.current = setTimeout(() => setOpen(false), 2500)
    document.addEventListener('mousedown', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  const dotSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  const label = STATUS_LABELS[status]

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Status: ${label}`}
        title={label}
        className={`flex shrink-0 items-center justify-center rounded-full p-1 hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none`}
      >
        <span className={`${dotSize} rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[0.6875rem] font-medium text-bg shadow-md"
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}
