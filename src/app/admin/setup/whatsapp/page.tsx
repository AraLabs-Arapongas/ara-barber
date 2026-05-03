import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExternalLink, MessageCircle } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { CommunicationStepFooter } from '../_components/communication-step-footer'

export default async function WhatsappStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage2.completed) redirect('/admin/setup')
  if (state.stage3.completed) redirect('/admin/setup')

  return (
    <>
      <ProgressIndicator stage={3} stepInStage={2} stepTitle="Mensagens WhatsApp" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Mensagens prontas pra você enviar pelo seu WhatsApp pessoal.{' '}
        <strong>Não enviamos automaticamente</strong> — botões aparecem no detalhe do
        agendamento e abrem seu WhatsApp com a mensagem pré-preenchida pra você
        revisar antes de mandar.
      </p>

      <div className="space-y-3">
        <SummaryCard
          title="Confirmação de agendamento"
          desc="Botão no detalhe do agendamento."
        />
        <SummaryCard
          title="Lembrete antes do horário"
          desc="Botão no detalhe do agendamento (envio manual)."
        />
        <SummaryCard
          title="Cancelamento"
          desc="Botão no detalhe quando você cancelar pelo painel."
        />
        <SummaryCard
          title="Compartilhar link de agendamento"
          desc="Botão na tela 'Link de agendamento' pra divulgar."
        />

        <Link
          href="/admin/dashboard/comunicacao/whatsapp"
          className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-primary hover:underline"
        >
          Editar templates
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <CommunicationStepFooter next="push" backHref="/admin/setup/email" />
    </>
  )
}

function SummaryCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5">
      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
      <div>
        <p className="text-[0.9375rem] font-medium text-fg">{title}</p>
        <p className="text-[0.8125rem] text-fg-muted">{desc}</p>
      </div>
    </div>
  )
}
