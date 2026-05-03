import { redirect } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { getOnboardingState } from '@/lib/onboarding/queries'
import { ProgressIndicator } from '../_components/progress-indicator'
import { CommunicationStepFooter } from '../_components/communication-step-footer'
import { StaffPushToggle } from '@/components/push/staff-push-toggle'
import { Card, CardContent } from '@/components/ui/card'

export default async function PushStepPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const state = await getOnboardingState(tenant.id)
  if (!state.stage2.completed) redirect('/admin/setup')
  if (state.stage3.completed) redirect('/admin/setup')

  return (
    <>
      <ProgressIndicator stage={3} stepInStage={3} stepTitle="Notificações da equipe" />
      <p className="mb-6 text-[0.875rem] text-fg-muted">
        Receba avisos push de novos agendamentos neste dispositivo. Funciona mesmo
        com o navegador fechado quando o app PWA está instalado. Cada dispositivo
        precisa ativar individualmente.
      </p>

      <Card className="shadow-xs">
        <CardContent className="p-0">
          <StaffPushToggle />
        </CardContent>
      </Card>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-bg-subtle/40 px-3 py-2.5 text-[0.8125rem] text-fg-muted">
        <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Ativar agora é opcional — você pode ligar depois em Mais → Notificações
          da equipe. Em iOS, instale o app na tela inicial antes de ativar.
        </span>
      </div>

      <CommunicationStepFooter next="finish" backHref="/admin/setup/whatsapp" />
    </>
  )
}
