import { MessageCircle } from 'lucide-react'

import { buildWhatsappFromTemplate } from '@/lib/contact/whatsapp'
import { cn } from '@/lib/utils'

/**
 * Botão "Enviar pelo WhatsApp" usado em telas autenticadas (ex: detalhe do
 * agendamento). Renderiza link `wa.me` com mensagem pré-preenchida a partir de
 * um template do tenant.
 *
 * Comportamentos:
 * - Sem telefone (ou inválido): renderiza botão desabilitado com tooltip.
 * - Telefone OK: âncora `<a target="_blank">` pra wa.me.
 *
 * `template` é o body cru com placeholders `{nome}`, `{servico}`, `{horario}`,
 * `{profissional}`, `{link}`. `vars` contém os valores. Placeholders sem
 * valor permanecem literais (ver `applyTemplate` em lib/contact/whatsapp.ts).
 */
export function WhatsappButton({
  phone,
  template,
  vars,
  label = 'Enviar pelo WhatsApp',
  className,
}: {
  phone: string | null | undefined
  template: string
  vars: Record<string, string | undefined | null>
  label?: string
  className?: string
}) {
  const url = buildWhatsappFromTemplate(phone, template, vars)

  if (!url) {
    return (
      <button
        type="button"
        disabled
        title="Cliente sem telefone cadastrado"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-[0.875rem] font-medium text-fg-subtle',
          'cursor-not-allowed opacity-70',
          className,
        )}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[0.875rem] font-medium text-fg shadow-xs transition-colors',
        'hover:bg-bg-subtle',
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  )
}
