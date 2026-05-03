import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExternalLink, Mail } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { CommunicationStepFooter } from '../_components/communication-step-footer'

export default async function EmailStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage2.completed) redirect('/admin/setup')
  if (state.stage3.completed) redirect('/admin/setup')

  return (
    <>
      <ProgressIndicator stage={3} stepInStage={1} stepTitle="E-mails automáticos" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Mensagens enviadas automaticamente para seus clientes. Templates padrão já
        funcionam — abra o editor abaixo se quiser personalizar.
      </p>

      <div className="space-y-3">
        <SummaryCard
          icon={<Mail className="h-4 w-4" />}
          title="Confirmação de agendamento"
          desc="Enviada assim que o cliente confirma."
        />
        <SummaryCard
          icon={<Mail className="h-4 w-4" />}
          title="Lembrete antes do horário"
          desc="Enviada 24h antes (configurável)."
        />
        <SummaryCard
          icon={<Mail className="h-4 w-4" />}
          title="Cancelamento"
          desc="Enviada quando staff ou cliente cancela."
        />
        <SummaryCard
          icon={<Mail className="h-4 w-4" />}
          title="Agradecimento pós-atendimento"
          desc="Mensagem opcional enviada após o atendimento."
        />

        <Link
          href="/admin/dashboard/comunicacao/emails"
          className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-primary hover:underline"
        >
          Editar templates
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <CommunicationStepFooter next="whatsapp" backHref="/admin/setup" />
    </>
  )
}

function SummaryCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5">
      <span className="mt-0.5 text-fg-muted">{icon}</span>
      <div>
        <p className="text-[0.9375rem] font-medium text-fg">{title}</p>
        <p className="text-[0.8125rem] text-fg-muted">{desc}</p>
      </div>
    </div>
  )
}
