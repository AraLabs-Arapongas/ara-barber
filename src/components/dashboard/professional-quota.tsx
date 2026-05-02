'use client'

import { useEffect, useId, useState } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { formatCentsToBrl } from '@/lib/money'

export type QuotaUsage = {
  activeCount: number
  included: number
  extraCount: number
  extraUnitPriceCents: number
  extraMonthlyCents: number
}

/**
 * Linha discreta de uso pra encaixar no header da página, sem card.
 * Mantém consistência com o resto do eyebrow info ("X trabalhando hoje").
 */
export function QuotaInline({
  usage,
  className = '',
}: {
  usage: QuotaUsage
  className?: string
}) {
  const { activeCount, included, extraCount, extraMonthlyCents } = usage
  const within = extraCount === 0
  const remaining = Math.max(0, included - activeCount)

  return (
    <p className={`text-[0.8125rem] ${within ? 'text-fg-muted' : 'text-warning'} ${className}`}>
      {within ? (
        <>
          {activeCount} de {included} inclusos
          {remaining > 0 ? ` · ${remaining} disponíveis sem custo extra` : ' · próximo gera cobrança extra'}
        </>
      ) : (
        <>
          {activeCount} ativos · {extraCount} {extraCount === 1 ? 'extra' : 'extras'} = +
          {formatCentsToBrl(extraMonthlyCents)}/mês
        </>
      )}
    </p>
  )
}

/**
 * Banner pequeno mostrando quantos profissionais ativos vs incluídos
 * no plano. Quando passa do limite, sinaliza o custo extra mensal.
 * Mantido pra outros lugares que queiram a versão "card".
 */
export function QuotaBanner({ usage }: { usage: QuotaUsage }) {
  const { activeCount, included, extraCount, extraMonthlyCents } = usage
  const within = extraCount === 0
  const remaining = Math.max(0, included - activeCount)

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
        within
          ? 'border-border bg-bg-subtle/60 text-fg-muted'
          : 'border-warning/30 bg-warning-bg/40 text-fg'
      }`}
      role="status"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          within ? 'bg-bg-subtle text-fg-muted' : 'bg-warning/15 text-warning'
        }`}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
        {within ? (
          <>
            <span className="font-medium text-fg">
              {activeCount} de {included} profissionais
            </span>{' '}
            inclusos no plano
            {remaining > 0 ? (
              <>
                {' '}
                · você pode adicionar mais {remaining} sem custo extra.
              </>
            ) : (
              <> · próximo profissional gera cobrança adicional.</>
            )}
          </>
        ) : (
          <>
            <span className="font-medium text-fg">
              {activeCount} profissionais ativos
            </span>{' '}
            ({extraCount} {extraCount === 1 ? 'extra' : 'extras'}) ={' '}
            <span className="font-medium text-fg">
              +{formatCentsToBrl(extraMonthlyCents)}/mês
            </span>{' '}
            sobre a mensalidade base.
          </>
        )}
      </div>
    </div>
  )
}

export type QuotaConfirmation = {
  extraUnitPriceCents: number
  currentExtraMonthlyCents: number
  newExtraMonthlyCents: number
  activeCount: number
  included: number
}

type ModalProps = {
  open: boolean
  data: QuotaConfirmation | null
  pending: boolean
  /** Texto do botão primário ("Confirmar e adicionar" / "Confirmar e reativar") */
  confirmLabel?: string
  /** Verbo usado no corpo ("adicionar" / "reativar") */
  actionVerb?: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Modal de confirmação de cobrança extra. Exige checkbox marcado pra
 * habilitar o botão de confirmar (consentimento explícito,
 * importante quando começar cobrança real).
 */
export function QuotaConfirmModal({
  open,
  data,
  pending,
  confirmLabel = 'Confirmar e adicionar',
  actionVerb = 'adicionar',
  onCancel,
  onConfirm,
}: ModalProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const checkboxId = useId()

  // Reseta o checkbox sempre que o modal abre
  useEffect(() => {
    if (open) setAcknowledged(false)
  }, [open])

  if (!data) return null

  const delta = data.newExtraMonthlyCents - data.currentExtraMonthlyCents

  return (
    <BottomSheet
      open={open}
      onClose={pending ? () => {} : onCancel}
      title="Cobrança adicional"
      description="Este profissional ultrapassa o que está incluso no plano."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-warning/30 bg-warning-bg/40 px-4 py-3 text-[0.875rem] leading-snug text-fg">
          Seu plano inclui{' '}
          <span className="font-medium">{data.included} profissionais</span>. Você
          já tem <span className="font-medium">{data.activeCount} ativos</span>.
          Ao {actionVerb}, sua mensalidade aumenta em{' '}
          <span className="font-semibold">+{formatCentsToBrl(delta)}/mês</span>{' '}
          ({formatCentsToBrl(data.extraUnitPriceCents)} por profissional adicional).
        </div>

        {data.currentExtraMonthlyCents > 0 ? (
          <div className="rounded-lg bg-bg-subtle/60 px-4 py-2.5 text-[0.8125rem] text-fg-muted">
            Cobrança extra atual:{' '}
            <span className="font-medium text-fg">
              {formatCentsToBrl(data.currentExtraMonthlyCents)}/mês
            </span>
            <br />
            Após {actionVerb}:{' '}
            <span className="font-medium text-fg">
              {formatCentsToBrl(data.newExtraMonthlyCents)}/mês
            </span>
          </div>
        ) : null}

        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-bg-subtle/60 px-3 py-2.5 text-[0.875rem] text-fg"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-primary"
            disabled={pending}
          />
          <span>
            Estou ciente de que minha mensalidade aumentará em{' '}
            <span className="font-medium">+{formatCentsToBrl(delta)}/mês</span>.
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onCancel}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={onConfirm}
            disabled={!acknowledged || pending}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
