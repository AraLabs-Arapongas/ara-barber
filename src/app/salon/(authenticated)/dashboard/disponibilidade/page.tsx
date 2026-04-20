import { redirect } from 'next/navigation'

/**
 * Rota legada — disponibilidade virou seção dentro de cada profissional.
 * Mantida por compatibilidade (FAB antigo, bookmarks), redireciona pra lista
 * de profissionais.
 */
export default function DisponibilidadePage() {
  redirect('/salon/dashboard/profissionais')
}
