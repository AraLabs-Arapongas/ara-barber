import { redirect } from 'next/navigation'

/**
 * Rota legada — disponibilidade virou tela central de Bloqueios na Mais.
 * Mantida por compatibilidade (FAB antigo, bookmarks).
 */
export default function DisponibilidadePage() {
  redirect('/admin/dashboard/bloqueios')
}
