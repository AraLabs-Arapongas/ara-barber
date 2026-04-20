import { redirect } from 'next/navigation'

/**
 * Rota legada — vínculo equipe×serviços virou chips dentro do detalhe de
 * cada profissional. Redireciona pra lista.
 */
export default function EquipeServicosPage() {
  redirect('/salon/dashboard/profissionais')
}
