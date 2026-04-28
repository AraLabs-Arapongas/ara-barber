'use client'

import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { isFeatureEnabled } from '@/lib/feature-flags'

/**
 * Programa de fidelidade — visual de "cartelinha" (loyalty stamp card).
 * Cliente acumula carimbos a cada atendimento; ao completar a meta
 * ganha o prêmio (ex: 10 cortes → 1 grátis).
 *
 * **Status:** mockado. Backend ainda não existe (não há tabela de
 * stamps/loyalty). Por isso vive atrás de feature flag em localStorage:
 * `ara:flag:loyalty-stamps` (default ON).
 *
 * Render:
 *   - Server-side / pré-hidratação: nada (evita flash de conteúdo
 *     mockado em produção real quando flag estiver desligada).
 *   - Client-side: lê flag e mock data, renderiza ou não.
 *
 * Quando virar feature real:
 *   1. Migration `loyalty_stamps` (tenant_id, customer_id, count, goal,
 *      reward_label, redeemed_at).
 *   2. Server query passada via prop em vez do mock.
 *   3. Remover feature flag (ou mover pra tabela `tenants.loyalty_enabled`).
 */
type StampData = {
  current: number
  goal: number
  reward: string
}

const MOCK_DATA: StampData = {
  current: 4,
  goal: 10,
  reward: 'Atendimento grátis',
}

export function LoyaltyStamps() {
  // `hydrated` evita mismatch SSR/client. Setado UMA vez na primeira
  // passada client-side; lint detecta `set-state-in-effect` mas é o
  // pattern correto pra "só rodar logic no cliente". Justificativa
  // explícita pra silenciar a regra.
  const [state, setState] = useState<{ hydrated: boolean; enabled: boolean }>({
    hydrated: false,
    enabled: false,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only init
    setState({ hydrated: true, enabled: isFeatureEnabled('loyalty-stamps', true) })
  }, [])

  if (!state.hydrated || !state.enabled) return null

  const { current, goal, reward } = MOCK_DATA
  const completed = current >= goal
  const remaining = Math.max(0, goal - current)

  return (
    <Card className="shadow-xs overflow-hidden">
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              Programa de pontos
            </p>
            <p className="mt-0.5 text-[0.9375rem] font-medium text-fg">
              {completed
                ? `Você ganhou: ${reward}`
                : remaining === 1
                  ? `Falta 1 pra ${reward.toLowerCase()}`
                  : `Faltam ${remaining} pra ${reward.toLowerCase()}`}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
            <Star className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        {/* Cartela de stamps. Em telas estreitas o grid quebra
            naturalmente; mantém max 5 por linha pra não ficar
            apertado. */}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: goal }).map((_, i) => {
            const filled = i < current
            return (
              <span
                key={i}
                aria-label={filled ? 'Stamp conquistado' : 'Stamp vazio'}
                className={`flex aspect-square items-center justify-center rounded-full border-2 ${
                  filled
                    ? 'border-brand-primary bg-brand-primary text-brand-primary-fg'
                    : 'border-dashed border-border bg-bg-subtle text-fg-subtle'
                }`}
              >
                {filled ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
            )
          })}
        </div>

        <p className="mt-3 text-[0.75rem] text-fg-muted">
          {current} de {goal} atendimentos
        </p>
      </CardContent>
    </Card>
  )
}
