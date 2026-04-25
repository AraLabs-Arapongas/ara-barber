> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Notificações do piloto — design

**Data:** 2026-04-20
**Status:** Design aprovado, aguardando plano de implementação
**Escopo:** Primeira onda de notificações pro piloto real do ara-barber (cliente + staff). Não substitui a futura evolução de billing/comunicação rica (Fase 2+).

---

## 1. Contexto e motivação

Fase 1 explicitamente deixou notificações fora ("Out of Phase 1: e-mail transacional além do de auth, SMS, WhatsApp, lembretes automáticos"). Pro piloto rodar com salão real, precisamos de:

- Cliente receber **confirmação** quando agenda
- Cliente receber **lembretes** antes do atendimento pra reduzir no-show
- Cliente ser avisado se o salão cancelar a reserva dele
- Staff saber quando entra novo agendamento e quando cliente cancela

Este doc define a primeira implementação. Não cobre reagendamento (pulado no MVP, virá junto com billing — ver memória `project_rescheduling_with_billing`) nem multi-idioma (PT-BR hardcoded).

## 2. Canais e cobertura

### Matriz de eventos × canais

| Evento | Email cliente | Push cliente | Push staff |
|---|---|---|---|
| `appointments` INSERT | ✅ confirmação | ✅ "horário marcado" | ✅ "novo agendamento" |
| `appointments` UPDATE → `status = CANCELED` | ✅ recibo cancelamento | ✅ "reserva cancelada" | ✅ "reserva cancelada" |
| `appointments` UPDATE → outros status | — | — | — |
| cron: `start_at - 24h` | — | ✅ lembrete | — |
| cron: `start_at - 2h` | — | ✅ lembrete | — |

Push staff é fanout: dispara pra **todos** `user_profiles` ativos com role staff no mesmo `tenant_id` que tiverem subscription.

Status transitions `CONFIRMED`, `COMPLETED`, `NO_SHOW` não notificam nada — virariam spam.

## 3. Arquitetura

```
appointments (INSERT/UPDATE)
      │
      ▼
Supabase Database Webhook
      │
      ▼
edge function: on-appointment-event
      │
      ├──→ Resend (email cliente, quando aplicável)
      ├──→ Web Push API (cliente)
      └──→ Web Push API (fanout staff)

─────────────────────────────────

pg_cron a cada 5min → pg_net.http_post
      │
      ▼
edge function: send-reminders
      │
      ├─ Query: appointments em janela 24h±5min + 2h±5min sem flag
      ▼
      Web Push API (cliente)
      │
      ▼
      UPDATE appointments SET reminder_{24h|2h}_sent_at = now()
```

**Duas edge functions**, independentes:

- `on-appointment-event` — reage a eventos do banco em tempo real
- `send-reminders` — cron, olha a agenda futura próxima

**Módulos compartilhados** (importados pelas duas functions):
- `channels/email.ts` — wrapper do SDK Resend
- `channels/push.ts` — wrapper do `web-push` (envio) + queries de subscription
- `templates/*` — React Email pros 2 templates (confirmation, cancellation) + strings pros pushes

### Tradeoffs

- **Webhook-driven vs outbox table:** escolhido webhook-driven por simplicidade. Se aparecer perda de eventos em prod, outbox é aditivo sem refazer a edge function.
- **2 edge functions vs 1 monolito:** 2 pra isolar cold start, logs e permissões.
- **Cron 5min vs realtime:** aceitável — janela de ±5min cobre o drift, e reminder "24h antes" é inerentemente aproximado.

## 4. Schema changes

### Tabela nova — `push_subscriptions`

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
```

- `tenant_id` nullable pra acomodar cliente com reserva em N salões (subscription é do user, não do tenant). Staff tem `tenant_id` preenchido.
- RLS: user pode ler/escrever as próprias subscriptions. Staff pode ler as do próprio tenant (pra dashboard futuro de alcance). Platform admin tudo.
- Cleanup: quando o push service retornar `410 Gone`, deletar a row.

### Tabela nova — `notification_log`

```sql
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  appointment_id uuid references public.appointments(id),
  channel text not null check (channel in ('email', 'push')),
  event text not null check (event in ('confirmation', 'cancellation', 'reminder_24h', 'reminder_2h')),
  recipient text,           -- email ou user_id do destinatário
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);
```

Auditoria + debug + dashboard futuro. Sem retry automático; é só log.

### Colunas novas em `appointments`

```sql
alter table public.appointments
  add column reminder_24h_sent_at timestamptz,
  add column reminder_2h_sent_at timestamptz,
  add column canceled_by text check (canceled_by in ('CUSTOMER', 'STAFF'));
```

- `reminder_*_sent_at`: idempotência do cron de lembretes.
- `canceled_by`: preenchido pelo server action ao cancelar (cliente cancelando a própria via `/meus-agendamentos` = `'CUSTOMER'`; staff cancelando = `'STAFF'`). Usado pelo template de email pra dizer "cancelado por você" vs "cancelado pelo salão".

### Colunas novas em `customers`

```sql
alter table public.customers
  add column pwa_installed_at timestamptz,
  add column pwa_install_dismissed_at timestamptz;
```

Visibilidade pro dono do salão sobre quem instalou a PWA (pra abordar manualmente).

## 5. Push lifecycle

### Consentimento — cliente

- Momento do `/book/confirmar`, logo após clicar "Confirmar reserva" e antes do redirect pra `/book/sucesso`: chama `Notification.requestPermission()`. Se aceitar, captura a subscription e envia pro backend via server action.
- Negou ou dismissou: segue normal. Perde push, mas recebe email de confirmação.

### Consentimento — staff

- Banner inline persistente no rodapé de `/salon/dashboard/agenda`: "Ativar avisos de novos agendamentos [Ativar] [×]".
- Clique em × → flag permanente em localStorage (`ara:staff-push-dismissed=1`). Banner some. **Sem coluna em DB** (staff não tem row em `customers`; tracking é puramente UX local).
- Recuperação: toggle em `/salon/dashboard/mais` → "Avisos por push" (ativar/desativar). Limpa a flag do localStorage.

### Install prompt — cliente (bottom sheet no login)

- Detecção de "não instalado": `window.matchMedia('(display-mode: standalone)').matches === false`.
- No primeiro login após detecção, abre bottom sheet:
  - **Chrome/Edge:** botão "Instalar" captura evento `beforeinstallprompt` e dispara dialog nativo do browser (1 clique).
  - **iOS Safari / Firefox / Safari desktop:** botão "Como instalar" mostra print/passo-a-passo manual ("Compartilhar → Adicionar à Tela de Início").
- Botão "Mais tarde" → `pwa_install_dismissed_at = now()` + localStorage. Não reabre por 30 dias.
- Ao detectar `display-mode: standalone` após instalação → server action preenche `pwa_installed_at` se nulo.

### Service Worker

- `public/sw.js` com listeners:
  - `push` → `self.registration.showNotification(title, { body, data, icon, badge })`. **Sem `sound`** — deixa SO decidir (Q5 decision: default OS sound, sem customização).
  - `notificationclick` → abre URL relevante em `event.notification.data.url`:
    - Push de novo agendamento (cliente) → `/meus-agendamentos`
    - Push de cancelamento (cliente) → `/meus-agendamentos`
    - Push de lembrete (cliente) → `/meus-agendamentos/[id]`
    - Push de novo agendamento (staff) → `/salon/dashboard/agenda/[id]`

### Fanout staff

Query no momento de disparo:

```sql
select ps.endpoint, ps.p256dh_key, ps.auth_key
from push_subscriptions ps
join user_profiles up on up.user_id = ps.user_id
where up.tenant_id = $1
  and up.role in ('SALON_OWNER', 'RECEPTIONIST', 'PROFESSIONAL')
  and up.is_active = true;
```

Dispara push em paralelo pra cada endpoint. Falhas 410 → delete da row, silencioso.

## 6. Email

### Sender

```
From:     AraLabs <avisos@aralabs.com.br>
Reply-To: <tenant.email> quando existe, senão igual ao From
```

Único remetente AraLabs pro MVP. Cliente que responder cai na inbox do salão.

### Templates (React Email)

Dois templates em `supabase/functions/_shared/templates/`:

- `BookingConfirmation.tsx` — conteúdo: data/hora formatadas em PT-BR com `America/Sao_Paulo` hardcoded, nome do serviço, nome do profissional, nome + endereço + contato do salão, logo do tenant no header, cor primária no botão "Ver reserva", link pra `/meus-agendamentos/[id]`.
- `BookingCanceled.tsx` — mesmos dados + cabeçalho "cancelado por você" ou "cancelado pelo salão" (via `appointments.canceled_by`), CTA "Agendar novamente" apontando pra `/book`.

### Failure handling

- Erro no Resend → INSERT em `notification_log` com `status='failed'` + `error_message`. Sem retry no MVP.
- Sucesso → INSERT em `notification_log` com `status='sent'`.

### Infra manual pré-produção

- Registrar domínio `aralabs.com.br` no Resend (UI dashboard)
- Configurar SPF + DKIM + DMARC no provedor DNS
- Validar domínio no Resend
- Gerar API key + guardar como secret Supabase

## 7. Reminders (cron)

### Schedule

```sql
select cron.schedule('send-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
$$);
```

Edge function `send-reminders` recebe e roda 2 queries:

```sql
-- janela 24h
select a.id, a.start_at, a.service_id, a.professional_id, a.tenant_id,
       c.user_id as customer_user_id, c.name as customer_name
from appointments a
join customers c on c.id = a.customer_id
where a.status in ('SCHEDULED', 'CONFIRMED')
  and a.reminder_24h_sent_at is null
  and a.start_at between now() + interval '23 hours 55 minutes'
                      and now() + interval '24 hours 5 minutes';

-- janela 2h (análoga, usando reminder_2h_sent_at)
```

Pra cada row:
1. Envia push ao `customer_user_id`
2. Se sucesso → `update appointments set reminder_Xh_sent_at = now()` + log
3. Se subscription 410 → delete subscription + log failure (não reenvia; próximo cron não vai achar)

### Garantias

- **Idempotente:** flag na mesma transação do envio; segunda execução do cron pula.
- **Janela de 10min** cobre drift do cron + cold start da edge function.
- **Cancelados pulam** via filtro `status`.
- **Perda possível** se a function cair >10min seguidos cruzando a janela de um appointment — aceito pro MVP, improvável.

### Timezone

Não é usado no cron (comparações em UTC via `timestamptz`). No **texto** do push/email, formatter hardcoda `America/Sao_Paulo`.

## 8. Env vars e secrets

Novos:

- `RESEND_API_KEY` (secret Supabase)
- `RESEND_FROM_EMAIL` (secret Supabase) — `avisos@aralabs.com.br`
- `RESEND_FROM_NAME` (secret Supabase) — `AraLabs`
- `VAPID_PUBLIC_KEY` — exposta ao client (Next env `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY` (secret Supabase)
- `VAPID_SUBJECT` (secret Supabase) — `mailto:avisos@aralabs.com.br`
- `CRON_SECRET` (secret Supabase) — bearer token que a edge function valida

## 9. Rollout por fases

Implementação fatiada pra debugar incremental:

- **Fase A — infra base:** migrations (push_subscriptions, notification_log, colunas de appointments/customers), VAPID keys geradas, Resend configurado, module `channels/*` esqueleto. Sem emitir nada.
- **Fase B — email confirmação:** edge function `on-appointment-event` + webhook configurado + email de confirmação disparando no INSERT.
- **Fase C — push cliente:** service worker `public/sw.js` + registration flow no `/book/confirmar` + bottom sheet de install no login + push no INSERT.
- **Fase D — push staff:** banner na agenda + toggle em `/mais` + fanout staff no INSERT.
- **Fase E — cancelamento:** email + push no UPDATE `status=CANCELED`.
- **Fase F — reminders:** cron + edge function `send-reminders` + flags em appointments.
- **Fase G — polish + smoke test atualizado.**

Cada fase = commit/PR separado.

## 10. Validação

**Sem testes automatizados no MVP** (decisão do dono do produto). Validação via **smoke test manual** atualizado em `docs/smoke-test-pilot.md`:

1. Agendar pelo wizard → email de confirmação chega + push chega no device instalado
2. Cancelar como cliente → email recibo + push cliente + push staff
3. Cancelar como staff → email recibo cliente + push cliente + push staff
4. Forçar `start_at = now() + 24h` + aguardar cron → push de lembrete chega
5. Dismissar bottom sheet de install → reabre só após 30 dias
6. Dismissar banner push staff → toggle em /mais funciona pra reativar
7. iOS sem PWA → não recebe push, email chega normal
8. Cliente instala PWA → `pwa_installed_at` preenchido, badge "📱 Instalado" em `/salon/dashboard/clientes`

## 11. Custos projetados (piloto, 10 salões × 500 agendamentos/mês)

| Item | Uso | Limite free | % usado |
|---|---|---|---|
| Edge function invocations | ~9.000/mês | 500.000 | 1,8% |
| Emails Resend | ~550/mês | 3.000 | 18% |
| Web Push | N/A | ilimitado | 0% |
| Cold storage DB | < 1 MB | GB | irrelevante |

**Custo estimado MVP: $0/mês.** Cresce quando: Resend (>3k emails → $20/mês) ou Supabase Pro (>500k invocations ou limite DB).

## 12. Não escopo (explicit)

- Reagendamento (virá com billing — ver `project_rescheduling_with_billing`)
- Notificação pra mudança de status `CONFIRMED`/`COMPLETED`/`NO_SHOW`
- SMS, WhatsApp
- Templates editáveis por tenant
- Sender email por tenant
- Reminder configurável por tenant
- Retry automático de email falho
- Dashboard de deliverability no painel do salão (só a tabela `notification_log` fica lá pra consulta SQL)

## 13. Referências

- Memória `project_rescheduling_with_billing` — decisão de adiar reagendamento.
- Memória `project_money_flow` — AraLabs merchant of record; importante quando expandir notificação pra incluir pagamento.
- Spec Fase 1: `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md` — definia notificações como out of scope.
