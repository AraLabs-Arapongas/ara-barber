import Link from 'next/link'
import { AlertTriangle, CalendarOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export type AttentionItem =
  | { kind: 'late'; appointmentId: string; customerName: string; minutes: number }
  | { kind: 'no-schedule'; professionalId: string; professionalName: string }

export function AttentionSection({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="my-4">
        <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Atenção
        </h2>
        <Card className="shadow-xs">
          <CardContent className="py-3 text-[0.875rem] text-fg-muted">
            Tudo certo por enquanto. Nenhuma pendência importante hoje.
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="my-4">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        Atenção
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={
              item.kind === 'late'
                ? `late-${item.appointmentId}`
                : `no-schedule-${item.professionalId}`
            }
          >
            {item.kind === 'late' ? (
              <Link href={`/admin/dashboard/agenda/${item.appointmentId}`} className="block">
                <Card className="shadow-xs transition-colors hover:bg-warning-bg/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <p className="text-[0.875rem] text-fg">
                      <span className="font-medium">{item.customerName}</span> está atrasado
                      {item.minutes > 0 ? ` há ${item.minutes} min` : ''}.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Link
                href={`/admin/dashboard/profissionais/${item.professionalId}`}
                className="block"
              >
                <Card className="shadow-xs transition-colors hover:bg-warning-bg/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <CalendarOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <p className="text-[0.875rem] text-fg">
                      <span className="font-medium">{item.professionalName}</span> está sem horário
                      configurado.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
