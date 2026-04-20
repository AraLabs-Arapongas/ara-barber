'use client'

import { useRouter } from 'next/navigation'
import { UserPlus, Scissors, CalendarX } from 'lucide-react'
import { Fab, type FabAction } from './fab'

/**
 * FAB global do salão com speed dial. Aparece em todas as páginas
 * autenticadas. Criação de agendamento é out-of-scope do pilot
 * (todo cliente agenda online), então não aparece aqui.
 */
export function GlobalFab() {
  const router = useRouter()

  const actions: FabAction[] = [
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
