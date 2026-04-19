import { PlaceholderPage } from '@/components/mock/placeholder-page'

export default function AgendaPage() {
  return (
    <PlaceholderPage
      eyebrow="Operação"
      title="Agenda"
      description="Seus agendamentos de hoje, semana e futuros aparecem aqui."
      backHref="/salon/dashboard"
      backLabel="Início"
    />
  )
}
