# Combo bookings — design (2026-04-29)

> Cliente pode reservar múltiplos serviços numa única ida ao
> estabelecimento, executados back-to-back (manicure → cabelo) por
> profissionais iguais ou diferentes. Garante atendimento sem espera
> entre serviços.

## Contexto

Hoje o flow `/book` exige uma reserva por serviço. Cliente que quer
"manicure + cabelo no mesmo dia" precisa criar 2 reservas separadas,
sem garantia de slots adjacentes — pode acabar esperando 1h entre
um e outro, ou descobrindo que um dos slots sumiu enquanto fazia a
segunda reserva.

Combo resolve: **uma única ação no app reserva o bloco contíguo
inteiro com os profissionais certos**.

Beachhead beleza tem isso como caso comum (manicure + escova,
barba + corte, etc). Diferencial competitivo direto contra Booksy
e WhatsApp manual.

## Decisões UX (brainstorming 2026-04-29)

1. **Ordem dos serviços:** cliente escolhe explicitamente. Wizard
   ganha step "Ordem" (entre Serviço e Profissional) com setas
   ↑↓ pra reordenar. Aparece só quando >1 serviço.
2. **"Qualquer profissional":** mesma semântica de hoje. Se cliente
   escolher "Qualquer" pra um serviço, sistema resolve internamente
   (primeiro prof livre no slot) e mostra escolha no Confirmar.
3. **Buffer entre serviços:** novo campo `tenants.combo_buffer_minutes`
   (default 10, configurável 0–60 pelo BUSINESS_OWNER em "Mais →
   Regras"). Aplicado **apenas entre serviços com profissionais
   diferentes** (mesmo prof não precisa transição).
4. **Cancelamento:** tudo-ou-nada. Cancelar combo cancela todos os
   appointments do grupo em transação. Cancelamento parcial fica
   pra Fase 2 conforme demanda.

## Arquitetura

### Schema (migration `0030_combo_bookings.sql`)

```sql
create table public.appointment_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  status appointment_status not null default 'SCHEDULED',
  total_duration_minutes integer not null,
  total_price_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_groups_tenant_idx on appointment_groups(tenant_id);
create index appointment_groups_customer_idx on appointment_groups(customer_id);

alter table public.appointments
  add column group_id uuid references appointment_groups(id) on delete set null,
  add column position integer; -- 0..N-1 dentro do combo

create index appointments_group_idx
  on appointments(group_id) where group_id is not null;

alter table public.tenants
  add column combo_buffer_minutes integer not null default 10
    check (combo_buffer_minutes between 0 and 60);

-- RLS appointment_groups (espelha appointments)
alter table public.appointment_groups enable row level security;

create policy appointment_groups_tenant_staff_all on appointment_groups
  for all using (is_tenant_staff(tenant_id))
  with check (is_tenant_staff(tenant_id));

create policy appointment_groups_customer_read on appointment_groups
  for select to authenticated
  using (customer_id in (
    select id from customers where user_id = (select auth.uid())
  ));

create policy appointment_groups_customer_insert on appointment_groups
  for insert to authenticated
  with check (customer_id in (
    select id from customers where user_id = (select auth.uid())
  ));

create policy appointment_groups_customer_update on appointment_groups
  for update to authenticated
  using (customer_id in (
    select id from customers where user_id = (select auth.uid())
  ));
```

**Princípios:**

- `group_id` em `appointments` é **nullable**. Single bookings têm
  `group_id = null` — todo código existente continua funcionando
  sem mudança.
- Combo = N rows em `appointments` ligadas pelo mesmo `group_id`,
  ordenadas por `position` (0, 1, 2...).
- `appointment_groups.status` é fonte da verdade pro estado do
  combo. `appointments.status` reflete (sincronizado pela Server
  Action de cancel).
- `total_duration_minutes` e `total_price_cents` no group são
  snapshots calculados no insert pra notificações e listagens
  rápidas (evitam SUM em runtime).
- `combo_buffer_minutes` em `tenants` é configurável; advisor
  performance fica calmo (FK em tenants já indexada).

### Slot calculator

**Função nova:** `computeComboSlots(input)` em `src/lib/booking/slots.ts`.

```ts
type ComboSlotInput = {
  services: Array<{
    serviceId: string
    durationMinutes: number
    professionalId: string | 'any' // ANY_PROFESSIONAL sentinel
    candidateProfessionalIds: string[] // se 'any', candidatos elegíveis
  }>
  bufferMinutes: number // de tenants.combo_buffer_minutes
  dateISO: string
  tenantTimezone: string
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  existingAppointments: Array<{ professionalId; startAt; endAt }>
  now: Date
  stepMinutes?: number
  minAdvanceHours?: number
}

type ComboSlot = {
  startISO: string // início do primeiro serviço
  endISO: string   // fim do último serviço
  segments: Array<{
    serviceId: string
    professionalId: string // resolvido (pra 'any' vira o real)
    startISO: string
    endISO: string
  }>
  available: boolean
}
```

**Algoritmo:**

```
pra cada T de business_start até business_end (step stepMinutes):
  current_time = T
  resolved_segments = []

  pra cada service in services:
    # busca primeiro prof livre nesse horário
    candidates = service.professionalId === 'any'
      ? service.candidateProfessionalIds
      : [service.professionalId]

    chosen = primeiro prof em candidates onde:
      - available pelo schedule (professional_availability)
      - sem block em current_time .. current_time + service.duration
      - sem appointment conflict
      - dentro de business_hours

    se chosen é null → slot inválido, pula pra próximo T
    resolved_segments.push({
      serviceId, professionalId: chosen,
      startISO: current_time, endISO: current_time + duration
    })

    # avança time + buffer (se prof != próximo)
    current_time += service.duration
    se próximo service existe E prof != próximo prof:
      current_time += bufferMinutes

  push slot { startISO: T, endISO: current_time, segments, available: true }
```

**Pontos:**

- Reusa as queries existentes (`getProfessionalAvailability`,
  `getAvailabilityBlocksInRange`, `getAppointmentsInRange`) — só
  precisa de `professionalIds` da união de todos profs candidatos
  do combo.
- Single bookings continuam usando o `computeSlots` atual sem
  mexer (zero risco regressão).
- "Qualquer" resolve internamente pegando primeiro prof livre,
  igual ao comportamento atual.

### Wizard

Sequência de steps (URL params em `?step=...&serviceIds=...&order=...&prof_<sid>=...&startAt=...`):

1. **`service`** (multi-select)
   - Cards continuam padrão atual mas permitem N seleções (clique alterna).
   - Subtítulo: "Pode escolher mais de um".
   - Footer sticky com qty + duração total + preço total + botão Continuar
     (visível só quando ≥1 selecionado).

2. **`order`** (só se `services.length > 1`)
   - Lista vertical dos serviços selecionados, cada um com setas ↑↓.
   - Cabeçalho: "Em que ordem você quer fazer?"
   - Skip automático pra step 3 se 1 serviço só.

3. **`professional`** (1 picker por serviço, ordem do step 2)
   - N seções verticais, cada uma é um `ProfessionalStep` adaptado.
   - "Qualquer profissional" sempre 1ª opção em cada serviço.
   - Continuar habilita quando todos os serviços têm prof escolhido.

4. **`datetime`**
   - Igual ao atual, mas usa `computeComboSlots` se >1 serviço.
   - Cabeçalho mostra "Bloco de Xh, Y min de buffer entre profissionais".
   - Slots no grid mostram horário inicial (do primeiro serviço).

5. **`confirm`**
   - Lista cada serviço com prof + horário individual + duração + valor.
   - Total: duração + valor agregados.
   - Confirma reserva = chama `confirmBookingAction` ajustada pra criar
     group + N appointments em transação.

### Confirm action (server)

Refator de `confirmBookingAction`:

```ts
type ConfirmInput = {
  tenantId
  segments: Array<{ serviceId, professionalId, startAt, endAt }>
  customerName, customerPhone
}

async function confirmBookingAction(input):
  - Validate input via Zod
  - ensureCustomerForTenant
  - Update customer profile (name/phone)
  - Se segments.length === 1: chama createAppointment atual (compat).
  - Se segments.length > 1: createComboAppointment (nova):
    - Em transação:
      - Insert appointment_groups (status SCHEDULED, totals computados)
      - Pra cada segment, validate_appointment_conflict + insert appointment
        com group_id + position
      - Se qualquer conflict, rollback e retorna erro "Horário indisponível"
  - recordAudit('booking.create' ou 'booking.create_combo')
  - revalidatePath
```

### Cancelamento

Server action nova `cancelGroupBooking({groupId, reason?})`:

- Valida ownership (RLS já cobre, mas double-check no app).
- Lê todos appointments do group, valida `min(start_at)` contra
  `tenants.cancellation_window_hours`.
- Em transação:
  - UPDATE appointment_groups SET status='CANCELED', updated_at=now()
  - UPDATE appointments SET status='CANCELED', canceled_at, canceled_by,
    cancel_reason WHERE group_id=$1
- recordAudit('booking_group.cancel', changes={ services, reason })
- revalidatePath('/meus-agendamentos')

`cancelCustomerAppointment` existente continua válido pra single
bookings. UI decide qual chamar baseado em `appointment.group_id`.

### Listagens

**Cliente (`/meus-agendamentos`, home carousel):**

Helper novo `groupBookings(appointments)` em `src/lib/appointments/grouping.ts`:

```ts
type DisplayBooking =
  | { kind: 'single'; appointment: AgendaAppointment }
  | { kind: 'combo'; group: { id, status, segments[] } }

function groupBookings(appointments): DisplayBooking[]
  // appointments com group_id null → kind: 'single'
  // appointments com mesmo group_id → kind: 'combo' (sorted by position)
```

UI cliente renderiza:

- Single: card atual.
- Combo: card com badge "🔗 Combo", lista compacta dos serviços
  (Manicure + Cabelo · 1h30), profs concatenados (Tatiana e Rafael),
  status do group.

Detalhe do combo: nova rota `/meus-agendamentos/combo/[groupId]` com
lista expandida de cada segment (serviço, prof, horário individual).

**Staff (`/admin/dashboard/agenda`):**

Zero mudança funcional. Cada appointment continua sendo 1 row na
agenda do prof responsável. Adicionar badge pequeno (ex: "🔗 Combo")
no card do appointment quando `group_id != null` — sinaliza pro
staff que o cliente vai pra outro prof depois (decisão final, não
opcional).

### Edge cases

- **Cliente seleciona 1 serviço só:** combo não acontece, fluxo igual
  ao de hoje (sem step "Ordem", insert em appointments sem group_id).
- **"Qualquer" pra todos:** resolve um prof por serviço (podem ser
  iguais ou diferentes); mostra escolhas no Confirmar.
- **Buffer = 0** (tenant configurou): back-to-back literal, mesma UX.
- **Mesmo prof em todos os serviços:** buffer NÃO aplica entre eles
  (transição = continuar atendendo). Buffer aplica só no boundary
  prof != prof.
- **Conflict mid-flow:** alguém pega slot intermediário entre cliente
  avançar pro step Confirmar e clicar Submit → server action valida
  cada segment via RPC `validate_appointment_conflict`, retorna
  erro claro "Algum horário ficou indisponível, escolha outros".
- **Combo entra em CONFIRMED parcialmente:** edge case raro
  (concurrent UPDATE). Transação garante atomicidade.
- **Cancel com 1 serviço já COMPLETED:** server action rejeita
  "Esse combo já está em andamento, fale com o estabelecimento".

### Backward compat

- Schema mudanças são **aditivas** (colunas novas nullable, nova
  tabela). Nenhuma constraint nova em dados existentes.
- Single bookings (todos os existentes hoje) preservam comportamento
  100% sem código mudar.
- Helper `groupBookings()` é aplicado **apenas** na lista do cliente.
  Single appointments retornam `kind: 'single'` e renderizam como hoje.
- Realtime existente continua broadcasting per-appointment; UI cliente
  agrupa em runtime.
- Notificações por email (edge function `on-appointment-event`)
  recebem 1 evento por appointment do combo. Aceito pra Fase 1
  (cliente recebe N emails) — agrupar em 1 email por combo é tech
  debt registrado em `docs/futuro.md`.

## Testing

- **pgTAP** (`supabase/tests/database/`):
  - Combo isolation cross-tenant (cliente A não vê group de tenant B)
  - Cancel cascata (UPDATE group → todos appointments do group viram CANCELED)
  - Buffer config respeitado em combo

- **Unit** (`src/lib/booking/__tests__/slots.test.ts`):
  - `computeComboSlots`: 2 serviços mesmo prof (sem buffer)
  - `computeComboSlots`: 2 serviços profs diferentes (com buffer)
  - `computeComboSlots`: "Qualquer" em um dos serviços
  - `computeComboSlots`: 3 serviços com buffer = 0
  - `computeComboSlots`: nenhum slot disponível por conflict no meio

- **Smoke (`docs/smoke-test-pilot.md`):**
  - Atualizar seção do wizard /book com fluxo combo (5 steps).
  - Adicionar seção de combo em /meus-agendamentos (card agregado +
    detail page nova).
  - Adicionar caso de cancelar combo (tudo cancela).

## Esforço estimado

| Phase | Esforço |
|---|---|
| Schema + types + tenant context + admin Regras | 1.5h |
| Wizard UX (steps Ordem + N pickers + URL params + multi-select) | 3-4h |
| `computeComboSlots` + tests unit | 2-3h |
| Confirm action + transaction + audit | 1.5h |
| Cliente list grouping + carousel + detail page | 2-3h |
| Cancel server action + UI | 1h |
| pgTAP + smoke update | 1h |
| **Total** | **~12-15h** |

## Fora de escopo desta iteração

- Cancelamento parcial (cancela só 1 serviço do combo).
- Combo paralelo (manicure ENQUANTO cabelo seca — exige 2 profs ao
  mesmo tempo).
- Email único agregando todos serviços do combo (hoje N emails).
- Reagendar combo via wizard (hoje só link manual pré-preenchido pro
  primeiro serviço).
- Sticky footer no step Serviço com animação (entrega em CSS estático).

## Referências

- Wizard atual: `src/components/book/wizard.tsx`
- Slot calculator atual: `src/lib/booking/slots.ts`
- Confirm action atual: `src/app/book/confirmar/actions.ts`
- Customer list: `src/components/appointments/my-appointments-list.tsx`
- Audit log: `src/lib/audit/log.ts`
- Decisões UX: brainstorming session 2026-04-29 (este doc)
