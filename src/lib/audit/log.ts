import 'server-only'

import { createSecretClient } from '@/lib/supabase/secret'
import type { Database } from '@/lib/supabase/types'

type Json = Database['public']['Tables']['audit_log']['Insert']['changes']

export type AuditEntry = {
  /** Tenant onde a ação aconteceu. Null só pra ações cross-tenant (raríssimo). */
  tenantId: string | null
  /** auth.uid() do ator. Null pra jobs/cron sem usuário. */
  actorUserId: string | null
  /** Snapshot do role do ator no momento (CUSTOMER, BUSINESS_OWNER, etc). */
  actorRole: string | null
  /**
   * Ação canônica em formato `entidade.verbo` (snake_case com ponto).
   * Convenção: substantivo no singular + verbo no presente.
   * Ex: `appointment.cancel`, `tenant.rules.update`, `customer.delete`.
   */
  action: string
  /** Tipo da entidade afetada (ex: 'appointment', 'tenant'). */
  entityType?: string
  /** ID da entidade afetada (FK pra tabela do entityType). */
  entityId?: string | null
  /**
   * Payload livre. Convenções úteis:
   *   - `before` / `after` quando é update
   *   - `reason` em cancelamentos
   *   - qualquer field específico da ação
   */
  changes?: Record<string, unknown>
}

/**
 * Grava uma linha em `audit_log`. NUNCA throws — falha é log silencioso
 * pra não quebrar a ação principal do usuário. Idealmente integrar com
 * Sentry pra capturar quando audit falha sistematicamente.
 *
 * Server-only (importa secret client). Chame de server actions, route
 * handlers, edge functions — nunca de client component.
 *
 * Uso típico:
 * ```
 * await recordAudit({
 *   tenantId: tenant.id,
 *   actorUserId: user.id,
 *   actorRole: 'CUSTOMER',
 *   action: 'appointment.cancel',
 *   entityType: 'appointment',
 *   entityId: appt.id,
 *   changes: { reason: input.reason ?? null, status_before: 'CONFIRMED' },
 * })
 * ```
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createSecretClient()
    const { error } = await supabase.from('audit_log').insert({
      tenant_id: entry.tenantId,
      actor_user_id: entry.actorUserId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      changes: (entry.changes ?? null) as Json,
    })
    if (error) {
      console.error('[audit] insert failed:', error.message, { action: entry.action })
    }
  } catch (e) {
    console.error('[audit] unexpected error:', e)
  }
}
