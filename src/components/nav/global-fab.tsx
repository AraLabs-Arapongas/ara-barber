'use client'

import { useRouter } from 'next/navigation'
import { Calendar, UserPlus, Scissors, CalendarX } from 'lucide-react'
import { Fab, type FabAction } from './fab'

/**
 * FAB global do salão com speed dial. Aparece em todas as páginas
 * autenticadas e permite criar rapidamente os 4 recursos mais comuns.
 * Cada ação navega pra página correspondente com `?new=1`, que faz o
 * sheet de criação abrir automaticamente.
 */
export function GlobalFab() {
  const router = useRouter()

  const actions: FabAction[] = [
    {
      label: 'Novo agendamento',
      icon: Calendar,
      onClick: () => router.push('/salon/dashboard/agenda?new=1'),
    },
    {
      label: 'Novo profissional',
      icon: UserPlus,
      onClick: () => router.push('/salon/dashboard/profissionais?new=1'),
    },
    {
      label: 'Novo serviço',
      icon: Scissors,
      onClick: () => router.push('/salon/dashboard/servicos?new=1'),
    },
    {
      label: 'Bloqueio de agenda',
      icon: CalendarX,
      onClick: () => router.push('/salon/dashboard/disponibilidade?new=1'),
    },
  ]

  return <Fab srLabel="Ações rápidas" actions={actions} />
}
