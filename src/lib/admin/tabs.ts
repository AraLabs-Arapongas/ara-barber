/**
 * Ordem das tabs do bottom-tab-nav. Compartilhada entre o componente
 * visual de tabs e o swipe navigator (que precisa saber qual é a
 * próxima/anterior tab).
 *
 * `match` define quais paths "pertencem" à tab — usado tanto pra marcar
 * tab ativa visualmente quanto pra detectar onde o swipe está atualmente.
 */
export type TabHref =
  | '/admin/dashboard'
  | '/admin/dashboard/agenda'
  | '/admin/dashboard/profissionais'
  | '/admin/dashboard/servicos'
  | '/admin/dashboard/mais'

export type TabDef = {
  href: TabHref
  label: string
  match: (pathname: string) => boolean
}

export const ADMIN_TABS: TabDef[] = [
  {
    href: '/admin/dashboard',
    label: 'Início',
    match: (p) => p === '/admin/dashboard',
  },
  {
    href: '/admin/dashboard/agenda',
    label: 'Agenda',
    match: (p) => p.startsWith('/admin/dashboard/agenda'),
  },
  {
    href: '/admin/dashboard/profissionais',
    label: 'Equipe',
    match: (p) => p.startsWith('/admin/dashboard/profissionais'),
  },
  {
    href: '/admin/dashboard/servicos',
    label: 'Serviços',
    match: (p) => p.startsWith('/admin/dashboard/servicos'),
  },
  {
    href: '/admin/dashboard/mais',
    label: 'Mais',
    match: (p) =>
      p.startsWith('/admin/dashboard/mais') ||
      p.startsWith('/admin/dashboard/clientes') ||
      p.startsWith('/admin/dashboard/configuracoes') ||
      p.startsWith('/admin/dashboard/financeiro') ||
      p.startsWith('/admin/dashboard/relatorios') ||
      p.startsWith('/admin/dashboard/disponibilidade') ||
      p.startsWith('/admin/dashboard/equipe-servicos') ||
      p.startsWith('/admin/dashboard/perfil') ||
      p.startsWith('/admin/dashboard/operacao'),
  },
]

export function findActiveTabIndex(pathname: string): number {
  return ADMIN_TABS.findIndex((t) => t.match(pathname))
}
