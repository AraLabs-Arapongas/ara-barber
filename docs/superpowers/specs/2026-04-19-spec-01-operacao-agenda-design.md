> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Spec 1 — Operação da Agenda (pilot)

**Data:** 2026-04-19
**Status:** Design aprovado, aguardando plano de implementação
**Escopo de release:** Pilot com 1-2 salões reais, PWA instalável (em Spec 2), sem transações financeiras

---

## Goal

Fechar o que falta pra um salão operar a agenda de ponta a ponta:

- Configurar horário de trabalho (do salão e por profissional)
- Bloquear datas/horas (feriado, folga, evento)
- Receber agendamentos públicos vindos do wizard existente
- Ver a agenda do dia **em tempo real** numa tela de tablet
- Executar transições de status (confirmar / cancelar / no-show / concluir)
- Cliente cancelar pelo app dentro da janela configurada

Após Spec 1, o salão já pode operar — falta só PWA forte (Spec 2) e polimento/hardening (Spec 3) pra fechar pilot.

---

## Decisões de escopo

### In scope

- UI de `business_hours` (por tenant) — confirmar/completar se já parcial
- UI de `professional_availability` (por profissional, com fallback pra business_hours)
- UI de `availability_blocks` (folga/feriado/bloqueio)
- UI de `professional_services` (matriz profissional × serviço)
- `/salon/dashboard/agenda` com **Supabase Realtime** + navegação dia-a-dia + bottom sheet de detalhes
- Server actions de status transitions (Zod-validated) com rules
- Postgres function `validate_appointment_conflict` pra centralizar validação de conflito
- Botão "Cancelar" em `/meus-agendamentos` respeitando janela por-tenant
- LGPD: endpoints `/perfil/dados` (export JSON) + `/perfil/apagar-conta` (soft-delete + anonimização)

### Out of scope (pra Spec 2 ou 3)

- **Walk-in / criação manual pelo staff** — removido: pilot assume que todo cliente agenda online. Salões que aceitarem pilot topam a restrição
- PWA install prompt, service worker, web push → **Spec 2**
- Edit / soft-delete de profissionais/serviços → **Spec 3**
- Error tracking (Sentry), rate limiting, security headers extras → **Spec 3**
- Drag-and-drop pra reagendar → pós-MVP (complexidade alta + risco de conflito)
- Combo de serviços (manicure + pedicure num único appointment) → Fase 2
- WhatsApp / SMS OTP → Fase 2 (precisa billing)

### LGPD (cross-cutting)

Spec trata LGPD como transversal, não como épico separado:

- **Consentimento** implícito no OTP público: tela de login tem texto "Ao entrar, você concorda com a Política de Privacidade" + link
- `customers.consent_given_at = now()` na primeira verificação OTP bem-sucedida (coluna nova, default null)
- **Export de dados** em `/perfil/dados` — gera JSON com nome, email, telefone, agendamentos completos
- **Direito ao esquecimento** em `/perfil/apagar-conta` — soft-delete `customers` row + anonimiza `appointments` (nome → "Cliente removido", email/telefone → null). Appointments **não são deletadas** (histórico operacional do salão)
- Link pra política de privacidade no footer das telas públicas (conteúdo real pode ser placeholder no pilot, mas o link tem que existir)

---

## Arquitetura

### Schema changes

Mínimas. Migrations via `mcp__supabase__apply_migration`:

```sql
-- tenants: janela de cancelamento (horas antes do horário)
ALTER TABLE tenants ADD COLUMN cancellation_window_hours integer NOT NULL DEFAULT 2;

-- customers: momento de consentimento LGPD
ALTER TABLE customers ADD COLUMN consent_given_at timestamptz;

-- appointments: auditoria de cancelamento
ALTER TABLE appointments ADD COLUMN canceled_at timestamptz;
ALTER TABLE appointments ADD COLUMN canceled_by uuid REFERENCES auth.users(id);
ALTER TABLE appointments ADD COLUMN cancel_reason text;
```

Nenhuma tabela nova. `business_hours`, `professional_availability`, `availability_blocks`, `professional_services`, `appointments` já existem.

### Status machine

Enum `appointment_status` (já existe): `SCHEDULED, CONFIRMED, COMPLETED, CANCELED, NO_SHOW`.

Transições permitidas:

```
SCHEDULED → CONFIRMED      (staff manual; auto-confirm fica pra pós-pilot)
SCHEDULED → CANCELED       (staff sempre; cliente só dentro da janela)
SCHEDULED → NO_SHOW        (staff, somente start_at < now())
CONFIRMED → CANCELED       (mesma regra do SCHEDULED)
CONFIRMED → NO_SHOW        (staff, somente start_at < now())
CONFIRMED → COMPLETED      (staff, somente end_at < now())
```

Cada transição é uma **server action** em `src/app/salon/(authenticated)/actions/appointment-status.ts`:

- Input: `{ appointmentId, nextStatus, reason? }` (Zod)
- Guards: staff autenticado + tenant owner + estado atual permite + timing permite
- Escreve: `status`, `updated_at`, `canceled_at/by/reason` se aplicável
- Retorna: `{ ok: true }` ou `{ ok: false, error: '...' }`

Cliente tem ação equivalente em `src/app/meus-agendamentos/actions.ts` (`cancelCustomerAppointment`) que checa janela via `tenant.cancellation_window_hours`.

### Validação de conflitos

Função Postgres que centraliza regra de "esse slot tá livre?":

```sql
CREATE FUNCTION validate_appointment_conflict(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER  -- roda com RLS do usuário
AS $$
  SELECT NOT EXISTS (
    -- conflito com appointment existente (mesmo profissional, status ativo)
    SELECT 1 FROM appointments
    WHERE tenant_id = p_tenant_id
      AND professional_id = p_professional_id
      AND status NOT IN ('CANCELED', 'NO_SHOW')
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
      AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  ) AND NOT EXISTS (
    -- conflito com bloqueio
    SELECT 1 FROM availability_blocks
    WHERE tenant_id = p_tenant_id
      AND professional_id = p_professional_id
      AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at)
  );
  -- NOTA: validação de "dentro de business_hours / professional_availability"
  -- fica como check adicional no wizard (view-layer), porque requer
  -- comparar apenas hora-do-dia × timezone do tenant. Manter function simples.
$$;
```

Chamada em:
- Server action de booking público (defesa em profundidade; wizard já filtra client-side)
- Server actions que alteram horário de appointment

### Agenda live (staff)

`/salon/dashboard/agenda/page.tsx`:

- Server component: carrega appointments do dia inicial (hoje ou `?date=YYYY-MM-DD`), business_hours, professionals ativos
- Passa como prop inicial pra client component `<AgendaView>`
- Client component inscreve em Supabase Realtime:

```ts
supabase
  .channel(`agenda-${tenantId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'appointments',
      filter: `tenant_id=eq.${tenantId}` },
    (payload) => /* reconcile com state local */
  )
  .subscribe()
```

- Fallback: se canal cair (erro ou status !== SUBSCRIBED), dispara polling de 30s até reconectar
- Layout: header com `‹ data ›` + date picker; lista vertical de slots de 15min respeitando business_hours; appointments posicionados absolute dentro dos slots; cores por status

Tap em appointment → `<BottomSheet>` com detalhes + ações filtradas pelo status atual (ex: SCHEDULED → "Confirmar" + "Cancelar" + "Marcar como no-show" [só se passou a hora]).

### Availability UIs

**`/salon/dashboard/disponibilidade`** (confirmar / completar):
- Tab "Profissionais": lista profissionais; click abre `<BottomSheet>` com 7 linhas (mon-sun), cada uma com toggle "aberto" + time picker start-end + toggle "usar horário do salão" (fallback pra `business_hours`)
- Tab "Bloqueios": lista atual ordenada por data; botão "+" abre form (profissional, data/hora início-fim, motivo opcional)

**`/salon/dashboard/configuracoes/horarios`** (business_hours, já existe — confirmar completo no plan)

**`/salon/dashboard/equipe-servicos`** (professional_services, já existe — confirmar completo no plan)

### Endpoints LGPD

**`/perfil/dados`** (GET, API route ou server action que retorna Blob):
- Query do cliente atual: `customers` row + `appointments` do próprio
- Retorna `application/json` com header `Content-Disposition: attachment; filename="meus-dados-<data>.json"`

**`/perfil/apagar-conta`** (POST, server action):
- Confirmação obrigatória (modal + texto tipado "APAGAR")
- Server action:
  1. `UPDATE customers SET name='Cliente removido', email=null, phone=null, deleted_at=now() WHERE user_id = auth.uid()`
  2. `UPDATE appointments SET customer_name='Cliente removido' WHERE customer_id = <id>` (copia nome pra campo snapshot — ver schema change opcional)
  3. `supabase.auth.signOut()` + redireciona pra `/`

Coluna opcional: `appointments.customer_name_snapshot` (text) — gravada no INSERT com nome atual do cliente, usada depois do soft-delete pra staff ainda ver "quem era" no histórico. Se não gravarmos, histórico fica inútil pro salão. Recomendado.

---

## UX e telas

### Staff

1. **Agenda** (`/salon/dashboard/agenda`) — upgrade
2. **Disponibilidade** (`/salon/dashboard/disponibilidade`) — tabs Profissionais + Bloqueios
3. **Horários** (`/salon/dashboard/configuracoes/horarios`) — business_hours (confirmar)
4. **Equipe × Serviços** (`/salon/dashboard/equipe-servicos`) — matriz (confirmar)

### Cliente

5. **`/meus-agendamentos`** — card ganha botão "Cancelar" quando elegível (SCHEDULED/CONFIRMED + dentro da janela)
6. **`/perfil`** — itens "Baixar meus dados" + "Apagar minha conta" (destrutivo)

### Booking público

7. **Wizard `/book/*`** — só hardening no servidor: server action chama `validate_appointment_conflict` antes de inserir (mensagem específica de erro se conflitar)

---

## Testes, error handling, segurança

### Testes

- **pgTAP** em `appointments` RLS: staff de tenant A não pode UPDATE status de appointment de tenant B (parte do debt #15)
- **pgTAP** em `validate_appointment_conflict`: covers mesmo-prof overlap, prof-diferente-sem-conflito, block ativo, `exclude_id` funcionando
- **Vitest** nas server actions de status: cada transição permitida e cada bloqueio (timing, estado atual inválido, role errado)
- **Vitest** em `cancelCustomerAppointment`: janela cumprida, janela vencida, appointment do outro cliente (RLS bloqueia)
- **Playwright E2E** deferido (debt #7)
- **Smoke test manual** documentado:
  1. Cliente agenda via wizard (novo tenant ou existente)
  2. Staff vê na agenda em tempo real (sem F5)
  3. Staff confirma → cliente vê atualizado em `/meus-agendamentos`
  4. Staff marca no-show (depois de forçar start_at pro passado via SQL dev) → funciona
  5. Cliente tenta cancelar após janela → recebe erro específico
  6. Cliente cancela dentro da janela → vira CANCELED na agenda do staff em realtime
  7. Cliente apaga conta → appointments anonimizadas no dashboard

### Error handling

- Server actions retornam `{ ok, error }` — UI dispara toast ou Alert
- Conflito → erro específico: "Esse horário não está mais disponível"
- Realtime desconecta → polling 30s até reconectar + badge "ao vivo" vira "sincronizando"
- RLS deny → redirect pra login correspondente

### Segurança

- RLS em `appointments` já cobre UPDATE (revalidar policy existe pra staff do próprio tenant)
- `validate_appointment_conflict` com `SECURITY INVOKER` — não bypassa RLS
- `/perfil/apagar-conta` exige sessão customer autenticada
- Soft-delete não cascadeia em appointments (só anonimiza PII)

---

## Migração / rollout

- Migrations via MCP Supabase em ordem lógica
- Seed de availability default nos 2-3 tenants de pilot antes do corte (ex: mon-sat 9h-19h; dom fechado) — script em `scripts/seed-pilot-availability.ts`
- Feature flag **não necessária** — 1-2 tenants topam mudança direta
- Pré-pilot: fazer smoke test manual documentado acima; só libera pro salão real depois do green

---

## Não-objetivos explícitos deste spec

- Não resolver combo de serviços
- Não resolver walk-in
- Não resolver PWA install / web push (Spec 2)
- Não resolver edit/delete de profissionais (Spec 3)
- Não resolver drag-to-reschedule
- Não incluir WhatsApp/SMS OTP
- Não incluir audit log completo (vai pra Épico 9 / Spec 4+)

---

## Próximo passo

Plano de implementação detalhado via `superpowers:writing-plans`, com tasks ordenadas e dependências entre migrations, server actions, UIs e testes. Esperado: plan com 5-7 subtasks independentes o suficiente pra paralelizar parte (e.g. availability UI e status transitions podem ir em paralelo).
