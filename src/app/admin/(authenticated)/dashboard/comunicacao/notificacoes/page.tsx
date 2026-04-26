import { StaffPushToggle } from '@/components/push/staff-push-toggle'
import { Card, CardContent } from '@/components/ui/card'

export default function NotificacoesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Comunicação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Notificações da equipe
        </h1>
        <p className="mt-1 text-[0.9375rem] text-fg-muted">
          Receba avisos de novos agendamentos neste dispositivo. Funciona mesmo com o navegador
          fechado quando o app PWA está instalado.
        </p>
      </header>
      <Card className="shadow-xs">
        <CardContent className="p-0">
          <StaffPushToggle />
        </CardContent>
      </Card>
      <p className="mt-3 px-1 text-[0.8125rem] text-fg-muted">
        Cada dispositivo precisa ativar individualmente. Em iOS, instale o app na tela inicial antes
        de ativar.
      </p>
    </main>
  )
}
