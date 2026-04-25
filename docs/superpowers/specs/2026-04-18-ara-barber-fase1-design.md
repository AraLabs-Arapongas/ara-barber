> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# ara-barber — Spec Fase 1 (Core Operável)

**Data:** 2026-04-18
**Escopo:** SaaS multi-tenant para barbearias/salões — Fase 1 do roadmap (core operável, sem pagamento real).
**Fonte:** derivado da especificação em `tech-specs/ara-barber/spec_saas_barbearia_aralabs.md` com decisões de escopo, arquitetura e billing tomadas em sessão de brainstorming.

---

## 1. Resumo executivo

Construir um SaaS multi-tenant (white-label leve) para barbearias e salões, com foco em agendamento online, operação interna e branding por tenant. A Fase 1 entrega o **núcleo operável** — cadastros, agenda, agendamento público, dashboard do salão, painel administrativo da plataforma Aralabs e a estrutura de billing (trial + assinatura + taxa) — **sem cobrança real ainda**. Pagamento real (Pix/cartão, webhooks), comunicação (e-mail/WhatsApp) e premium (custom domain, multiunidade) ficam em Fases 2+.

A experiência é **mobile-first e PWA-centric**: o PWA é o core do produto, não um add-on. Cada salão tem seu próprio PWA instalável em `{slug}.aralabs.com.br`, com identidade visual própria. O dashboard do salão é responsivo e otimizado para operação em tablet landscape no balcão.

---

## 2. Escopo

### 2.1 Incluso na Fase 1

- Multi-tenancy (single database, shared schema, `tenantId` em todas as entidades de negócio, isolamento por RLS do Postgres).
- Auth para 3 tipos de usuário:
  - **Customer:** Google OAuth, Apple OAuth, Magic Link por e-mail (via Supabase Auth).
  - **Staff do salão** (owner, atendente, profissional): e-mail + senha (Supabase Auth).
  - **Platform admin** (Aralabs): e-mail + senha (Supabase Auth).
- Branding por tenant (logo, favicon, 3 cores, manifest PWA dinâmico).
- PWA completo: instalável em iOS/Android, ícone e cores por tenant, app-like UX.
- Cadastros: salão, profissionais, clientes, serviços, horários de funcionamento, disponibilidade por profissional, bloqueios de agenda.
- Agenda: visão por dia, por profissional, consolidada do salão; criação manual; check-in; iniciar/finalizar atendimento; cancelar; no-show; bloquear horário.
- Agendamento público: wizard mobile-first (serviço → profissional → data → horário → login → confirmar).
- Dashboard do salão: agenda + cadastros + relatórios básicos + configurações de branding e horários.
- Platform admin: CRUD de tenants, gerenciamento de trial (padrão e customizado), gerenciamento de planos globais, visão consolidada.
- **Estrutura de billing completa no schema e na lógica** (trial + assinatura mensal + taxa por transação, parametrizáveis), mas **sem cobrança real, sem gateway, sem webhook**. Expiração automática de trial via `pg_cron`.
- Modo Operação (simplified mode) no dashboard: esconde menus, mantém só agenda + status, Wake Lock, PIN para sair.
- Realtime: agenda atualiza sozinha via Supabase Realtime quando um appointment muda.
- Audit log para ações sensíveis.
- Testes de RLS (pgTAP), unitários (Vitest), smoke E2E (Playwright).

### 2.2 Fora da Fase 1 (deixado pra Fase 2+)

- Pagamento de sinal / cobrança real / Pix / cartão / webhook de gateway.
- Cobrança efetiva de mensalidade e taxa de transação (estrutura existe, enforcement não).
- Comunicação automática: e-mail transacional (além do de auth), SMS, WhatsApp.
- Lembretes automáticos.
- Registro de comissões por atendimento concluído.
- Financeiro (conciliação, relatório de recebimentos, inadimplência).
- Política de cancelamento com retenção / reembolso.
- DeviceLoan (rastreio administrativo de tablets em comodato).
- Custom domain por tenant (campo no schema, mas sem feature de verificação DNS/SSL).
- Multiunidade (uma conta = vários salões).
- Fidelidade, campanhas, marketplace.
- Sentry ou observability externa.
- Feature flags.
- Offline-first.

---

## 3. Decisões travadas

| Tema | Decisão |
|---|---|
| Escopo | Fase 1 — Core Operável, sem pagamento real |
| Stack backend/DB/auth | **Supabase** (Postgres + Auth + RLS + Storage + Realtime + pg_cron) |
| Stack frontend | Next.js 16 + React 19 + Tailwind 4 + TypeScript |
| Arquitetura de apps | 1 Next.js app, 3 áreas lógicas separadas por route groups + middleware de host |
| Lógica de negócio | Server Actions + Route Handlers em Next.js (approach A) |
| Jobs agendados | `pg_cron` no Postgres (expiração de trial) |
| Domínio | `aralabs.com.br` |
| Tenants em | `{slug}.aralabs.com.br` |
| Platform admin em | `admin.aralabs.com.br` |
| Ambiente dev | `*.lvh.me:3000` (resolve para `127.0.0.1`) |
| Custom domain por tenant | Fora de escopo; só campo `customDomain` no schema |
| PWA | Core do produto, obrigatório na Fase 1, manifest dinâmico por tenant |
| Mobile-first | Não-negociável; UI deve parecer app nativo, não site responsivo |
| Tablet (dashboard) | Responsivo com breakpoints — phone / tablet landscape / desktop no mesmo código |
| Modo Operação | Incluso; toggle simplificado + Wake Lock + PIN para sair |
| Realtime | Incluso; Supabase Realtime escuta `appointments` do tenant |
| Customer auth | Google + Apple + Magic link (Supabase Auth) |
| Staff auth | E-mail + senha (Supabase Auth) |
| Isolamento multi-tenant | RLS como primário, middleware/app como defesa em profundidade |
| Hospedagem | Vercel (frontend + middleware + server actions) + Supabase (DB/Auth/Storage/Realtime) |
| Custo alvo inicial | ~R$ 0/mês (Supabase Free, Vercel Hobby) até 5–10 tenants pagantes |

---

## 4. Arquitetura geral

### 4.1 Visão em camadas

```
┌───────────────────────────────────────────────────┐
│  Cliente (navegador mobile, PWA instalado)        │
│  ─ Public booking UI                              │
│  ─ Salon dashboard UI                             │
│  ─ Platform admin UI                              │
└──────────────┬────────────────────────────────────┘
               │ HTTPS
┌──────────────▼────────────────────────────────────┐
│  Next.js 16 app (Vercel)                          │
│  ─ Middleware: resolve tenant por host            │
│  ─ Route groups: (public) (salon) (platform)      │
│  ─ Server Actions + Route Handlers                │
│  ─ Manifest dinâmico por tenant                   │
└──────────────┬────────────────────────────────────┘
               │ @supabase/ssr
┌──────────────▼────────────────────────────────────┐
│  Supabase                                         │
│  ─ Postgres + RLS por tenantId                    │
│  ─ Auth (Google, Apple, Magic link, Email+senha) │
│  ─ Storage (logos, fotos)                         │
│  ─ Realtime (agenda live)                         │
│  ─ pg_cron (expiração de trial)                   │
└───────────────────────────────────────────────────┘
```

### 4.2 Princípios de design

1. **Mobile-first e app-like em toda UI.** PWA é core, não extra.
2. **Tenant é resolvido no middleware** antes do SSR e injetado no contexto da request.
3. **Isolamento primário via RLS do Postgres**, não middleware de app. Impossível "esquecer um where".
4. **Service role do Supabase só no servidor**, nunca no cliente. Client-side usa chave anônima + sessão.
5. **Três áreas lógicas num único Next.js app**, separadas por route groups e middleware de host.
6. **Validação com Zod em toda entrada** (Server Actions e Route Handlers).
7. **Billing parametrizável desde o início** — preços e percentuais em tabela, nunca em código.
8. **Defesa em profundidade:** RLS + asserções explícitas em server actions + validação de input com Zod.

### 4.3 Resolução de tenant (middleware)

Pseudocódigo do middleware:

```ts
const host = req.headers.get('host')

if (host === 'admin.aralabs.com.br') {
  area = 'platform'
  tenantId = null
} else if (host.endsWith('.aralabs.com.br') || host.endsWith('.lvh.me')) {
  slug = host.split('.')[0]
  tenantId = await resolveTenantBySlug(slug)   // cache 60s
  area = pathStartsWith('/dashboard') ? 'salon' : 'public'
} else if (tenant found by customDomain) {
  // futuro; schema preparado, feature desligada
} else {
  return 404
}

// injeta em headers internos + cookie context para server components
```

### 4.4 DNS e hospedagem

- **DNS (Cloudflare):** `aralabs.com.br` + wildcard `*.aralabs.com.br` + `admin.aralabs.com.br` → Vercel.
- **SSL:** wildcard cert automático via Vercel.
- **Vercel:** 1 projeto, deploy único; previews automáticos em PRs.
- **Supabase:** 1 projeto, 1 região (América Latina quando disponível, senão `us-east-1`).

---

## 5. Stack técnico

### 5.1 Dependências principais

```json
{
  "next": "16.x",
  "react": "19.x",
  "@supabase/supabase-js": "^2",
  "@supabase/ssr": "^0.5",
  "zod": "^3",
  "tailwindcss": "^4",
  "lucide-react": "^1",
  "date-fns": "^3",
  "date-fns-tz": "^3",
  "nanoid": "^5"
}
```

Sem TanStack Query inicialmente — Server Components + Server Actions cobrem. Adicionar depois se surgir necessidade real de cache client-side complexo.

### 5.2 Ferramentas de dev e CI

- **Supabase CLI** (migrations versionadas, `supabase db push`).
- **Supabase MCP** (já disponível no workspace) para gerar tipos e aplicar migrations.
- **context7 MCP** para consultar docs de Next.js 16 (pós training-cutoff — APIs mudaram).
- **Vitest** para testes unitários.
- **Playwright** para smoke E2E.
- **pgTAP** (ou `supabase db test`) para testes de RLS.
- **ESLint + Prettier.**
- **GitHub Actions** para CI.
- **Vercel** para hospedagem + previews.

### 5.3 Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=              # NUNCA expor no bundle client
NEXT_PUBLIC_APP_BASE_HOST=aralabs.com.br
NEXT_PUBLIC_PLATFORM_HOST=admin.aralabs.com.br
```

---

## 6. Modelo de dados

### 6.1 Entidades globais (sem `tenantId`)

| Entidade | Propósito |
|---|---|
| `auth.users` (Supabase) | identidade base (Google, Apple, magic link, email+senha) |
| `user_profiles` | perfil estendido do staff/platform admin: `userId`, `role`, `tenantId?`, `name`, `isActive` |
| `plans` | catálogo global de planos de billing |

### 6.2 Entidades por tenant (todas com `tenantId`)

| Entidade | Campos-chave |
|---|---|
| `tenants` | `id, slug, name, subdomain, customDomain?, status, timezone` + branding + billing |
| `professionals` | `id, tenantId, userId?, name, displayName?, photoUrl?, phone?, commissionType, commissionValue, isActive` |
| `customers` | `id, tenantId, userId?, name, phone, whatsapp?, email?, birthDate?, notes?, isActive` |
| `services` | `id, tenantId, name, description?, durationMinutes, priceCents, depositRequired, depositType?, depositValueCents?, depositPercentage?, isActive` |
| `professional_services` | `tenantId, professionalId, serviceId` |
| `business_hours` | `tenantId, weekday, startTime, endTime, isOpen` |
| `professional_availability` | `tenantId, professionalId, weekday, startTime, endTime, isAvailable` |
| `availability_blocks` | `tenantId, professionalId, startAt, endAt, reason?` |
| `appointments` | `id, tenantId, customerId, professionalId, serviceId, appointmentDate, startAt, endAt, status, paymentStatus, depositRequired, depositAmountCents?, totalAmountCents, notes?, bookedBySource, createdByUserId?, checkedInAt?, startedAt?, completedAt?, cancelledAt?, cancellationReason?` |
| `billing_events` | `id, tenantId, eventType, fromStateJson, toStateJson, actorUserId?, reason?, createdAt` (histórico estruturado de mudanças de billing — ver seção 8) |
| `audit_log` | `id, tenantId?, userId?, action, entityType, entityId, beforeJson, afterJson, createdAt` |

### 6.3 Campos de branding em `tenants`

`logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, contactPhone, whatsapp, email, addressLine1, addressLine2, city, state, postalCode`

### 6.4 Campos de billing em `tenants`

`trialStartsAt, trialEndsAt, trialDaysGranted, billingStatus, billingModel, currentPlanId, monthlyPriceCents (snapshot), transactionFeeType (snapshot), transactionFeeValue (snapshot), transactionFeeFixedCents? (snapshot), subscriptionStartsAt?, subscriptionEndsAt?, gracePeriodEndsAt?, isCustomTrial, notesInternal?`

### 6.4.1 Outros campos operacionais em `tenants`

`operationModePinHash?` (bcrypt do PIN de 4 dígitos do Modo Operação — ver 12.4; não é campo de billing).

> **Snapshot vs referência:** `currentPlanId` aponta para `plans`, mas campos de preço/taxa ficam duplicados em `tenants` como snapshot no momento da ativação. Isso permite mudar plano global sem mexer retroativamente no que cada tenant está pagando.

### 6.5 Enums

```ts
UserRole:            PLATFORM_ADMIN | SALON_OWNER | RECEPTIONIST | PROFESSIONAL | CUSTOMER
TenantStatus:        ACTIVE | SUSPENDED | ARCHIVED
BillingStatus:       TRIALING | ACTIVE | PAST_DUE | SUSPENDED | CANCELED
BillingModel:        TRIAL | SUBSCRIPTION_WITH_TRANSACTION_FEE
TransactionFeeType:  PERCENTAGE | FIXED | NONE
BillingEventType:    TRIAL_STARTED | TRIAL_EXTENDED | TRIAL_CUSTOMIZED | TRIAL_EXPIRED
                   | PLAN_CHANGED | PRICING_OVERRIDDEN
                   | BILLING_ACTIVATED | GRACE_PERIOD_ENDED
                   | SUSPENDED | REACTIVATED | CANCELED
AppointmentStatus:   PENDING_PAYMENT | CONFIRMED | CHECKED_IN | IN_SERVICE | COMPLETED | CANCELLED | NO_SHOW | EXPIRED
PaymentStatus:       UNPAID | PENDING | PAID_PARTIAL | PAID_FULL | REFUNDED | CHARGEBACK | FAILED | EXPIRED
DepositType:         FIXED | PERCENTAGE
CommissionType:      PERCENTAGE | FIXED
BookingSource:       PUBLIC_WEB | SALON_MANUAL | IMPORT
```

### 6.6 Relacionamentos-chave

```
tenants (1) ──< professionals ──< professional_services >── services
tenants (1) ──< customers
tenants (1) ──< business_hours
tenants (1) ──< appointments ──> (customer, professional, service)
plans (1) ──< tenants  (via currentPlanId)
auth.users (1) ──< user_profiles (0-1 staff) + customers (0-N, um por tenant)
```

### 6.7 Regras importantes

1. **Customer é um por tenant.** O mesmo `auth.users.id` pode ter N linhas em `customers` (uma por tenant em que agendou).
2. **`user_profiles` é só para staff e platform admin.** Customer fica apenas em `customers`.
3. **Billing em `tenants` direto**, sem tabela `subscription_history` na Fase 1.
4. **`plans` é global e parametrizável.** Platform admin CRUDa planos pelo painel.
5. **Soft-delete via `isActive: boolean`** em professionals, services, customers. Sem DELETE físico — agenda passada precisa continuar consistente.
6. **`appointments.paymentStatus` existe mas só transita entre `UNPAID` e `PAID_FULL` (manual) na Fase 1.** Sem tabela `payments`.

### 6.8 Entidades explicitamente ausentes na Fase 1

`payments`, `commission_entries`, `notifications`, `device_loans`. Estrutura no schema **não é criada** — se aparecer no código, entra em outra fase.

> Observação: **`billing_events` é criada na Fase 1** e cobre a necessidade de "histórico básico de mudanças de billing" pedida na decisão comercial. Não há tabela `subscription_history` separada.

---

## 7. Multi-tenancy e isolamento (RLS)

### 7.1 Princípio

**RLS do Postgres é a fonte da verdade para isolamento entre tenants.** Middleware e código de aplicação são defesa em profundidade. Mesmo que o código esqueça um `where tenantId`, o banco bloqueia.

### 7.2 Funções helper em SQL

```sql
create function auth.current_tenant_id() returns uuid
language sql stable as $$
  select tenant_id from user_profiles where user_id = auth.uid() limit 1
$$;

create function auth.current_role() returns user_role
language sql stable as $$
  select role from user_profiles where user_id = auth.uid() limit 1
$$;

create function auth.is_platform_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and role = 'PLATFORM_ADMIN'
  )
$$;
```

### 7.3 Padrão de policies por entidade

**Entidades de tenant (appointments, services, professionals, customers, etc):** 4 policies por tabela.

```sql
-- Platform admin vê/escreve tudo
create policy "platform_admin_all" on appointments
  for all using (auth.is_platform_admin());

-- Staff do tenant vê/escreve dentro do próprio tenant
create policy "staff_tenant_scoped" on appointments
  for all using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());

-- Customer vê só os próprios appointments
create policy "customer_own_appointments" on appointments
  for select using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- Customer cria seu próprio appointment via public booking
create policy "customer_insert_own" on appointments
  for insert with check (
    customer_id in (select id from customers where user_id = auth.uid())
  );
```

**Entidades globais (plans, tenants):**

```sql
create policy "plans_read_all_authenticated" on plans
  for select using (auth.uid() is not null);

create policy "plans_write_platform_admin" on plans
  for all using (auth.is_platform_admin());

create policy "tenants_platform_admin" on tenants
  for all using (auth.is_platform_admin());

create policy "tenants_staff_read_own" on tenants
  for select using (id = auth.current_tenant_id());
```

### 7.4 Leitura anônima (homepage do salão)

O cliente **não logado** precisa ver serviços, profissionais e disponibilidade do salão para agendar. **Não via RLS anônima** (fácil de errar). Usa-se **Server Action dedicada** com `service role`, que recebe `tenantId` do middleware (confiável, resolvido do host) e retorna dados públicos filtrados.

### 7.5 Convenção de PR

Toda tabela com `tenantId` criada num PR precisa obrigatoriamente vir com as 4 policies (platform admin / staff / customer read / customer write) e os testes de pgTAP correspondentes. Teste de RLS é parte do Definition of Done.

### 7.6 Uso de service role

Service role **nunca** no cliente. Usar apenas em:
- Leitura pública da home do salão (anônimo não tem `auth.uid()`).
- Jobs `pg_cron` que rodam sem usuário.
- Criação de tenant pelo platform admin (se a policy ficar muito barroca).

### 7.7 Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Esquecer policy em nova tabela | Convenção: 4 policies obrigatórias no PR; pgTAP test obrigatório |
| Customer com 2 contas Google se confundir | `customers.userId` único por `(userId, tenantId)` |
| JWT expirado passar | Supabase Auth cuida; middleware revalida sessão |
| Subdomain não existir | Middleware retorna 404 |
| Platform admin tocar tenant suspenso | Platform admin ignora `tenant.status`; staff tem `tenant.status = ACTIVE` como pré-requisito |

---

## 8. Billing, Trials e Planos

### 8.1 Princípios do modelo comercial

O modelo de monetização da plataforma Aralabs é **trial grátis → mensalidade fixa + taxa por transação**, com todos os parâmetros (dias de trial, preço de mensalidade, tipo e valor da taxa) **parametrizáveis** — nunca hardcoded.

- Todo tenant começa em **trial gratuito** (30 dias por padrão).
- Durante o trial, o tenant tem acesso completo ao produto — nenhuma feature bloqueada.
- Ao final do trial, o tenant transita para **plano pago**.
- Plano pago tem duas fontes de receita:
  - **Mensalidade fixa** (recorrente — efetiva na Fase 2+).
  - **Taxa por transação** (percentual ou fixo, aplicada sobre transações elegíveis — efetiva na Fase 2+).
- Platform admin pode customizar qualquer parâmetro por tenant (trial estendido, plano custom, override de preço).
- Todo parâmetro é persistido em banco de dados; nenhum está em código.

### 8.2 Entidades de billing

#### 8.2.1 `plans` (catálogo global)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `code` | text | identificador curto (ex: `STARTER`, `PRO`, `PREMIUM`) |
| `name` | text | nome de exibição |
| `description` | text? | descrição opcional |
| `monthlyPriceCents` | int | preço da mensalidade em centavos |
| `transactionFeeType` | enum | `PERCENTAGE | FIXED | NONE` |
| `transactionFeeValue` | int | em basis points (se %) ou centavos (se FIXED) |
| `transactionFeeFixedCents` | int? | componente fixo para modelo híbrido futuro |
| `trialDaysDefault` | int | trial default quando esse plano é atribuído (normalmente 30) |
| `isActive` | bool | plano disponível para novos tenants |
| `isDefault` | bool | plano atribuído automaticamente a novos tenants se nenhum for informado |
| `createdAt` / `updatedAt` | timestamptz | |

#### 8.2.2 `tenants` (campos de billing — snapshot do estado atual)

| Campo | Tipo | Descrição |
|---|---|---|
| `currentPlanId` | uuid (FK → `plans`) | plano atualmente atribuído |
| `billingStatus` | enum | `TRIALING | ACTIVE | PAST_DUE | SUSPENDED | CANCELED` |
| `billingModel` | enum | `TRIAL | SUBSCRIPTION_WITH_TRANSACTION_FEE` |
| `monthlyPriceCents` | int | **snapshot** do preço na ativação (permite override por tenant) |
| `transactionFeeType` | enum | **snapshot** do tipo de taxa |
| `transactionFeeValue` | int | **snapshot** do valor da taxa |
| `transactionFeeFixedCents` | int? | **snapshot** do componente fixo |
| `trialStartsAt` | timestamptz | |
| `trialEndsAt` | timestamptz | |
| `trialDaysGranted` | int | quantos dias foram concedidos (default 30, override permitido) |
| `isCustomTrial` | bool | trial customizado manualmente pelo platform admin |
| `subscriptionStartsAt` | timestamptz? | quando assinatura paga foi ativada |
| `subscriptionEndsAt` | timestamptz? | fim do ciclo atual (Fase 2+) |
| `gracePeriodEndsAt` | timestamptz? | fim do grace period após PAST_DUE |
| `notesInternal` | text? | anotações administrativas do platform admin |

> **Por que snapshot e não só referência?** Mudar preço global de um plano **não afeta** tenants já ativos. Tenant congela seu preço/taxa no momento da ativação. Se o admin quiser atualizar, faz explicitamente via override e gera `billing_events`.

#### 8.2.3 `billing_events` (histórico estruturado de mudanças)

Toda transição ou mudança relacionada a billing gera um registro:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | uuid (FK → `tenants`) | |
| `eventType` | enum `BillingEventType` | tipo do evento |
| `fromStateJson` | jsonb | snapshot dos campos de billing **antes** da mudança |
| `toStateJson` | jsonb | snapshot **depois** |
| `actorUserId` | uuid? | quem disparou; `null` quando foi `pg_cron` |
| `reason` | text? | motivo textual (ex: "trial estendido por cortesia ao cliente") |
| `createdAt` | timestamptz | |

### 8.3 Tipos de evento de billing

```ts
BillingEventType:
  TRIAL_STARTED          // tenant criado em TRIALING
  TRIAL_EXTENDED         // admin estendeu o trialEndsAt
  TRIAL_CUSTOMIZED       // admin alterou a duração do trial (pós-criação)
  TRIAL_EXPIRED          // transição automática para PAST_DUE (pg_cron)
  PLAN_CHANGED           // currentPlanId mudou
  PRICING_OVERRIDDEN     // preço ou taxa customizados pelo admin
  BILLING_ACTIVATED      // transição para ACTIVE
  GRACE_PERIOD_ENDED     // transição PAST_DUE → SUSPENDED (pg_cron)
  SUSPENDED              // suspensão manual
  REACTIVATED            // reativação pelo platform admin
  CANCELED               // cancelamento definitivo
```

### 8.4 Ciclo de vida do billing

```
┌──────────────┐
│  (criação)   │
└──────┬───────┘
       │ onboarding
       ▼
┌──────────────┐
│  TRIALING    │ ◄───────────┐
└──────┬───────┘             │ reativação
       │                     │ (platform admin escolhe)
       │ trial_ends_at < now │
       │ (pg_cron diário)    │
       ▼                     │
┌──────────────┐             │
│  PAST_DUE    │             │
└──┬────────┬──┘             │
   │        │                │
   │        │ pagamento      │
   │        │ efetivado      │
   │        │ (Fase 2+)      │
   │        │ ou ativação    │
   │        │ manual (Fase 1)│
   │        ▼                │
   │   ┌──────────────┐      │
   │   │   ACTIVE     │ ◄────┤
   │   └──────┬───────┘      │
   │          │ inadimplência│
   │          │ (Fase 2+)    │
   │          ▼              │
   │     (volta PAST_DUE)    │
   │                         │
   │ grace_period_ends_at    │
   │ < now (pg_cron)         │
   ▼                         │
┌──────────────┐             │
│  SUSPENDED   │ ────────────┘
└──────┬───────┘
       │ platform admin cancela
       ▼
┌──────────────┐
│  CANCELED    │  (estado terminal)
└──────────────┘
```

### 8.5 Regras do trial

1. **Trial padrão:** 30 dias. Valor vem de `plans.trialDaysDefault` do plano atribuído no onboarding.
2. **Customização na criação:** platform admin pode criar tenant com `trialDaysGranted` diferente (ex: 60 dias pro amigo; 7 dias pro cliente urgente). Marca `isCustomTrial = true` e registra `TRIAL_CUSTOMIZED` em `billing_events`.
3. **Extensão durante trial ou PAST_DUE:** admin pode adicionar N dias ao `trialEndsAt` a qualquer momento. Gera `TRIAL_EXTENDED`.
4. **Encurtamento:** tecnicamente possível, logado como `TRIAL_CUSTOMIZED` (atípico).
5. **Acesso durante trial:** tenant em `TRIALING` tem acesso **completo** ao produto — nenhuma feature bloqueada.
6. **Transição automática:** `pg_cron` diário detecta trials expirados e transita para `PAST_DUE`.

### 8.6 Transições automáticas (pg_cron)

Job diário às 03:00 UTC (SQL simplificado; implementação real registra `billing_events` para cada linha afetada):

```sql
-- Job 1: Trial → PAST_DUE
update tenants
set billing_status = 'PAST_DUE',
    grace_period_ends_at = trial_ends_at + interval '7 days'
where billing_status = 'TRIALING'
  and trial_ends_at < now();

-- Job 2: PAST_DUE → SUSPENDED
update tenants
set billing_status = 'SUSPENDED'
where billing_status = 'PAST_DUE'
  and grace_period_ends_at < now();
```

Cada update dispara trigger que insere `billing_events` com tipo correspondente (`TRIAL_EXPIRED`, `GRACE_PERIOD_ENDED`), `actorUserId = null` e `reason = 'transição automática via pg_cron'`.

### 8.7 Ativação de plano pago

#### Fluxo Fase 1 (manual pelo platform admin)

Cobrança real ainda não existe. Admin pode marcar um tenant como `ACTIVE` manualmente (cenário: amigo começou a pagar por fora, platform admin registra).

1. Platform admin abre `/platform/tenants/[id]/billing`.
2. Clica "Ativar assinatura".
3. Confirma plano atual, ajusta preço (se override desejado), define `subscriptionStartsAt = now()`.
4. Sistema atualiza `billingStatus = ACTIVE`, registra snapshot de preço/taxa.
5. Grava `billing_events` com `BILLING_ACTIVATED`.

#### Fluxo Fase 2+ (automático via gateway)

Fora do escopo da Fase 1. Será implementado em spec separada cobrindo integração com gateway (Asaas/Mercado Pago/Stripe), webhook de confirmação, retry e dunning.

### 8.8 Cobrança recorrente (Fase 2+, fora do escopo)

Deixado documentado aqui para dar contexto arquitetural:

- Gateway de pagamento escolhido em spec separada da Fase 2.
- Webhook dispara renovação de `subscriptionEndsAt`.
- Falha de cobrança → retry automático → se esgotar → `billingStatus = PAST_DUE`.
- Dunning (e-mail/WhatsApp de cobrança) entra em Fase 3 com comunicação.

### 8.9 Aplicação da taxa por transação (Fase 2+, fora do escopo)

Deixado documentado para garantir coerência do schema na Fase 1:

- Taxa incide sobre o **valor do sinal efetivamente pago** (não sobre o valor total do serviço).
- Cálculo:
  - `PERCENTAGE`: `fee = round(signalAmount * transactionFeeValue / 10000)` (em basis points).
  - `FIXED`: `fee = transactionFeeFixedCents`.
  - `NONE`: sem taxa.
- Split automático pelo gateway: taxa debitada do repasse ao salão.
- Auditada em tabela futura `transaction_fees` (criada na Fase 2); não entra no `billing_events`.

### 8.10 Painel administrativo Aralabs — billing

#### Lista de tenants (`/platform/tenants`)
- Filtros por `billingStatus`.
- Views pré-configuradas:
  - "Em trial"
  - "Trial expirando (próximos 7 dias)"
  - "PAST_DUE" (precisam de ação)
  - "SUSPENDED"
  - "ACTIVE"
  - "CANCELED"

#### Gestão de planos (`/platform/plans`)
- CRUD de `plans`.
- Campos editáveis: nome, descrição, `monthlyPriceCents`, `transactionFeeType`, `transactionFeeValue`, `trialDaysDefault`, `isActive`, `isDefault`.
- Desativar plano: não deleta, apenas marca `isActive = false`. Tenants existentes continuam com snapshot.

#### Billing detalhado de tenant (`/platform/tenants/[id]/billing`)
- Estado atual (plano, preço snapshot, taxa snapshot, status, datas).
- Timeline de `billing_events` (histórico legível).
- Ações disponíveis:
  - **Estender trial** (input de +N dias)
  - **Customizar trial** (ajustar `trialEndsAt` arbitrariamente)
  - **Trocar plano** (atualiza snapshot de preço/taxa)
  - **Override de preço** (ajusta `monthlyPriceCents` sem mudar plano)
  - **Override de taxa** (ajusta `transactionFeeType` / `transactionFeeValue`)
  - **Ativar assinatura** (manual, Fase 1)
  - **Suspender manualmente** (motivo obrigatório)
  - **Reativar** (volta para `TRIALING` ou `ACTIVE` à escolha do admin)
  - **Cancelar** (terminal, confirmação explícita)

Toda ação registra `billing_events` com evento apropriado, `actorUserId` do platform admin e `reason` opcional.

### 8.11 Regras de negócio explícitas (billing)

1. Todo tenant começa em `TRIALING` salvo override manual do platform admin.
2. Trial default é 30 dias; valor vem de `plans.trialDaysDefault` do plano atribuído.
3. Platform admin pode sobrescrever duração de trial a qualquer momento (estender, encurtar, reiniciar).
4. Ao expirar trial (`trial_ends_at < now()`), tenant passa automaticamente para `PAST_DUE` com `grace_period_ends_at = trial_ends_at + 7 dias`.
5. Ao passar do grace period, tenant é automaticamente `SUSPENDED`.
6. Tenant `SUSPENDED`: staff não loga; página pública exibe mensagem de indisponibilidade; dados preservados.
7. Taxa por transação é **sempre parametrizada**, nunca hardcoded.
8. Preço da mensalidade é **snapshotado** em `tenants` no momento da ativação — mudar preço global do plano **não afeta** tenants já ativos.
9. **Toda mudança de billing** (status, plano, preço, trial) **obrigatoriamente** gera um registro em `billing_events`.
10. Apenas `PLATFORM_ADMIN` pode modificar campos de billing. Staff do tenant não tem acesso de leitura nem de escrita.
11. `CANCELED` é estado terminal; tenant não volta dele sem criar novo registro.
12. Taxa é aplicada sobre **transações elegíveis** (definidas na Fase 2). Na Fase 1 a regra de elegibilidade é documentada no schema mas não executada.

### 8.12 Fase 1 vs Fase 2+

| Item | Fase 1 | Fase 2+ |
|---|---|---|
| Schema completo (`plans`, campos em `tenants`, `billing_events`) | ✅ | — |
| CRUD de planos pelo platform admin | ✅ | — |
| Criação de tenant com trial automático | ✅ | — |
| Override manual de trial (estender, encurtar, customizar) | ✅ | — |
| Suspensão e reativação manual | ✅ | — |
| `pg_cron`: transições automáticas (TRIALING → PAST_DUE → SUSPENDED) | ✅ | — |
| Ativação manual de assinatura (lógica, sem dinheiro) | ✅ | — |
| `billing_events` (histórico auditado) | ✅ | — |
| Painel Aralabs com visões por status e billing detalhado | ✅ | — |
| MRR projetado / trial conversion / distribuição por plano | ✅ | — |
| **Cobrança real de mensalidade** (gateway, webhook, fatura) | ❌ | ✅ |
| **Aplicação da taxa transacional** (split, reembolso) | ❌ | ✅ |
| **Dunning** (cobrança em atraso automatizada) | ❌ | ✅ |
| **Reembolso / chargeback** | ❌ | ✅ |
| **MRR efetivo / churn / LTV** | ❌ | ✅ |

### 8.13 Testes de billing (Fase 1)

Casos obrigatórios em Vitest / pgTAP:

- Criação de tenant com plano default → `billingStatus = TRIALING`, `trialEndsAt = now() + 30d`, evento `TRIAL_STARTED` gravado.
- Customização de trial na criação (60 dias) → `isCustomTrial = true`, evento `TRIAL_CUSTOMIZED`.
- `pg_cron` em tenant com `trialEndsAt` passado → `billingStatus = PAST_DUE`, `gracePeriodEndsAt = trialEndsAt + 7d`, evento `TRIAL_EXPIRED`.
- `pg_cron` em tenant PAST_DUE com grace period vencido → `SUSPENDED`, evento `GRACE_PERIOD_ENDED`.
- Staff de tenant SUSPENDED não consegue logar.
- Página pública de tenant SUSPENDED exibe mensagem de indisponibilidade.
- Mudança de plano global não altera snapshot em tenants já ativos.
- Staff do tenant (SALON_OWNER) não consegue modificar campos de billing (RLS).
- Platform admin consegue editar qualquer campo de billing de qualquer tenant.

---

## 9. Autenticação

### 9.1 Providers Supabase Auth

| Público | Providers |
|---|---|
| Customer (cliente do salão) | Google OAuth + Apple OAuth + Magic Link por e-mail |
| Staff (owner, atendente, profissional) | E-mail + senha (magic link opcional) |
| Platform admin | E-mail + senha (magic link opcional) |

### 9.2 Fluxo de login de staff

1. Staff abre `{slug}.aralabs.com.br/dashboard` → redireciona `/login`.
2. E-mail + senha (ou magic link opcional).
3. Supabase Auth valida, retorna sessão.
4. Middleware verifica:
   - `user_profiles` existe para o user.
   - `role` é staff (`SALON_OWNER | RECEPTIONIST | PROFESSIONAL`).
   - `user_profiles.tenantId == tenantId resolvido pelo host` (senão 403).
   - `tenants.status == ACTIVE` e `billing_status in (TRIALING, ACTIVE, PAST_DUE)`.
5. Redireciona para `/dashboard`.

**Isolamento por host:** staff do tenant A não consegue logar pela URL do tenant B mesmo com credenciais válidas — o match `host × tenantId` no middleware bloqueia.

### 9.3 Fluxo de login de platform admin

1. Abre `admin.aralabs.com.br/login`.
2. E-mail + senha (ou magic link).
3. Middleware verifica `role == PLATFORM_ADMIN`.
4. Redireciona para `/platform`.

### 9.4 Fluxo de customer (inline no agendamento)

Ver seção 10.3.

### 9.5 Sessões

- Cookies httpOnly + SameSite=Lax (default do `@supabase/ssr`).
- Magic links expiram em 1h.
- Rate limit no login (configurável no Supabase Auth).
- Revalidação de sessão em toda server action sensível via `assertStaff()` / `assertPlatformAdmin()`.

---

## 10. Fluxos principais

### 10.1 Onboarding de tenant (platform admin)

1. Aralabs abre `admin.aralabs.com.br/tenants/new`.
2. Preenche: name, slug, e-mail do owner, plano default, trial days (default 30).
3. Server action:
   - Cria `tenants` row com `billingStatus=TRIALING`, `trialStartsAt=now()`, `trialEndsAt=now()+30d`.
   - Invita owner via `supabase.auth.admin.inviteUserByEmail()`.
   - Cria `user_profiles` row com `role=SALON_OWNER`, `tenantId`.
4. Owner recebe e-mail com link.
5. Owner define senha → redirecionado para `{slug}.aralabs.com.br/dashboard/onboarding`.
6. Owner completa wizard: branding, business_hours, primeiro professional, primeiro service.
7. Página pública `{slug}.aralabs.com.br` fica ativa.

### 10.2 Expiração automática de trial

Ver seção 8.3.

### 10.3 Agendamento público (customer)

1. Customer anônimo abre `{slug}.aralabs.com.br` (mobile, PWA-ready).
2. Home mobile: hero com logo/cor do tenant + CTA "Agendar".
3. Wizard em etapas (telas cheias, transições app-like):
   1. Escolhe serviço (filtrado por `isActive`).
   2. Escolhe profissional (filtrado por `professional_services` e `isActive`).
   3. Escolhe data (próximos 30 dias).
   4. Escolhe horário (slots calculados).
   5. Tela de login: Google / Apple / Magic link.
   6. Callback: server action procura/cria `customers` row para `(userId, tenantId)`.
   7. Tela "confirmar dados": nome + telefone (pré-preenchidos do provider, editáveis).
   8. Confirma → server action valida slot livre + cria `appointment` com `status=CONFIRMED`, `paymentStatus=UNPAID`, `bookedBySource=PUBLIC_WEB`.
   9. Tela de sucesso + prompt "instalar app" (PWA).
4. Customer acessa `/my-bookings` para ver próximos agendamentos.

**Cálculo de slots disponíveis:**

```ts
function availableSlots(tenantId, professionalId, date, durationMin) {
  const businessHours = getBusinessHours(tenantId, weekday(date))
  const profAvail = getProfessionalAvailability(professionalId, weekday(date))
  const existing = getAppointments(tenantId, professionalId, date,
    ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'])
  const blocks = getAvailabilityBlocks(professionalId, date)
  const open = intersect(businessHours, profAvail)
  return generateSlotsEvery(15min, open, durationMin)
    .filter(slot => !collides(slot, existing) && !collides(slot, blocks))
}
```

### 10.4 Agendamento manual (salão)

1. Atendente abre `/dashboard/agenda`.
2. Clica em slot vazio ou botão "+ novo".
3. Wizard parecido com o público, mas:
   - Busca customer por nome/telefone ou cria novo (sem auth.users — registro "offline" do salão).
   - Escolhe service, professional, date, time.
4. Confirma → cria appointment `status=CONFIRMED`, `bookedBySource=SALON_MANUAL`, `createdByUserId=logado`.

### 10.5 Operação do dia

Estados de transição válidos:

```
CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED
    │            │            │
    └─ CANCELLED ┘            │
    └─ NO_SHOW (não compareceu)
```

Cada card na tela `/dashboard/agenda` tem botões contextuais:
- **CONFIRMED:** `Check-in`, `Cancelar`, `Reagendar`.
- **CHECKED_IN:** `Iniciar atendimento`, `No-show`.
- **IN_SERVICE:** `Finalizar`.
- **COMPLETED:** `Ver detalhes`.

Cada ação é uma server action que valida a transição + grava timestamp (`checkedInAt`, `startedAt`, `completedAt`, `cancelledAt`).

### 10.6 Cancelamento

- **Pelo customer (`/my-bookings`):** server action valida ownership + status (CONFIRMED/CHECKED_IN) + data futura. Sem política de antecedência na Fase 1. Registra `cancelledAt`, `cancellationReason='cliente'`.
- **Pelo salão (`/dashboard/agenda`):** `SALON_OWNER` e `RECEPTIONIST` podem cancelar qualquer appointment do tenant; `PROFESSIONAL` pode cancelar apenas os próprios. Motivo obrigatório, grava `createdByUserId`.
- Em ambos: `status=CANCELLED`, slot volta a aparecer disponível.

### 10.7 Reagendamento

Fase 1: cancelar + criar novo. Sem "histórico linkado" entre os dois. Simplificação consciente; revisita se virar problema real.

### 10.8 Bloqueio de horário

Profissional ou owner bloqueia intervalo (ex: consulta médica). Tabela dedicada `availability_blocks` (não reaproveita `appointments` com tipo BLOCK). `availableSlots()` já subtrai blocks.

### 10.9 Modo Operação

Toggle no dashboard (ícone "apresentação" ou similar). Quando ativo:
- Esconde menus secundários (relatórios, configs, equipe).
- Mantém: agenda + botões de status (check-in, iniciar, finalizar, no-show).
- Auto-refresh via Realtime (ver 10.10).
- Wake Lock API mantém tela acordada.
- Botão "Sair do modo" protegido por PIN de 4 dígitos (configurado em `/dashboard/configuracoes`, armazenado em `tenants.operationModePinHash` com bcrypt).

### 10.10 Realtime

- Canal Supabase Realtime escuta `appointments` do `tenantId` atual.
- Quando inserção/update/delete acontece, UI atualiza via revalidatePath ou estado client-side.
- Especialmente importante quando 2+ dispositivos operam no salão (tablet balcão + celular do profissional).

### 10.11 Override/extensão de trial (platform admin)

**Contexto:** amigo do salão pediu mais 30 dias pra testar antes de pagar; cliente novo quer período especial; erro operacional que precisa ser corrigido.

1. Platform admin abre `/platform/tenants/[id]/billing`.
2. Clica "Estender trial" → digita número de dias a adicionar + motivo opcional.
3. Server action valida:
   - Ator é `PLATFORM_ADMIN`.
   - Tenant está em `TRIALING` ou `PAST_DUE`.
   - Número de dias é positivo.
4. Atualiza `trialEndsAt = trialEndsAt + Ndias`; se estava em `PAST_DUE`, reverte para `TRIALING` e limpa `gracePeriodEndsAt`.
5. Grava `billing_events` com `eventType = TRIAL_EXTENDED`, `fromStateJson`, `toStateJson`, `actorUserId`, `reason`.
6. UI reflete novo estado.

Para customizar trial (ajustar `trialEndsAt` arbitrariamente): mesmo fluxo mas evento é `TRIAL_CUSTOMIZED`.

### 10.12 Ativação manual de plano pago (Fase 1)

**Contexto:** na Fase 1 não há cobrança real, mas platform admin precisa registrar "esse cliente tá pagando por fora" pra que o estado do sistema reflita realidade.

1. Platform admin abre `/platform/tenants/[id]/billing`.
2. Clica "Ativar assinatura".
3. Tela de confirmação mostra: plano atual, preço snapshot, taxa snapshot, data de início (default = now()).
4. Admin pode fazer override de preço (ajuste manual do `monthlyPriceCents` snapshot) ou manter.
5. Confirma → server action:
   - Valida tenant não está em `CANCELED`.
   - Atualiza `billingStatus = ACTIVE`, `subscriptionStartsAt = now()`.
   - Se houve override de preço/taxa, grava evento `PRICING_OVERRIDDEN` adicional.
   - Grava `billing_events` com `BILLING_ACTIVATED`.
6. Tenant agora pode receber mudança de plano, overrides, etc.

Na Fase 2+, esse fluxo deixa de ser manual e vira consequência do webhook do gateway.

### 10.13 Suspensão e reativação manual

#### Suspensão manual (platform admin)

1. Admin abre billing do tenant, clica "Suspender".
2. Motivo obrigatório (texto livre).
3. Server action:
   - Valida ator é `PLATFORM_ADMIN`.
   - Atualiza `billingStatus = SUSPENDED`.
   - Grava `billing_events` com `eventType = SUSPENDED`, `reason`.
4. Staff do tenant é deslogado na próxima revalidação de sessão; página pública entra em modo "indisponível".

#### Reativação (platform admin)

1. Admin abre tenant em `SUSPENDED` ou `PAST_DUE`, clica "Reativar".
2. Escolhe o estado de destino:
   - **`TRIALING`:** platform admin informa novos `trialDaysGranted` (cria novo período de trial).
   - **`ACTIVE`:** tenant vai direto para ativo; campos de subscription são repreenchidos.
3. Server action atualiza estado + limpa `gracePeriodEndsAt`.
4. Grava `billing_events` com `REACTIVATED` + snapshot do novo estado.
5. Staff volta a conseguir logar; página pública volta ao ar.

#### Cancelamento definitivo

1. Admin abre tenant, clica "Cancelar".
2. Confirmação explícita com digitação do slug do tenant (prevenção contra clique acidental).
3. Server action:
   - Atualiza `billingStatus = CANCELED`, `tenants.status = ARCHIVED`.
   - Grava `billing_events` com `CANCELED`.
4. Estado terminal. Dados são preservados (soft-delete) para auditoria; tenant não é mais acessível nem logável.

---

## 11. PWA

### 11.1 Requisitos

- Instalável em Android (beforeinstallprompt).
- Instalável em iOS (prompt manual "Adicionar à tela inicial").
- Ícone por tenant (192/512px em `.png`, armazenados em Supabase Storage).
- Nome e tema por tenant.
- Manifest dinâmico por tenant, servido por route handler.

### 11.2 Manifest dinâmico

`/api/manifest/[slug]/route.ts` gera JSON dinâmico:

```json
{
  "name": "{tenant.name}",
  "short_name": "{tenant.name}",
  "start_url": "https://{slug}.aralabs.com.br/",
  "display": "standalone",
  "background_color": "{tenant.primaryColor}",
  "theme_color": "{tenant.primaryColor}",
  "icons": [
    { "src": "{tenant.iconUrl192}", "sizes": "192x192", "type": "image/png" },
    { "src": "{tenant.iconUrl512}", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 11.3 Service worker

- Mínimo viável na Fase 1: registra para critério de instalabilidade, cacheia estáticos.
- Sem offline-first robusto (fora de escopo).
- Consultar docs atuais do Next.js 16 via context7 MCP antes de implementar — Next.js 16 tem mudanças.

### 11.4 Foco de escopo

- **Customer público:** PWA é prioritário; experiência app-like é diferencial de marca.
- **Salon dashboard:** também PWA, mas o ganho é secundário (staff já tá logado no tablet); o foco é layout responsivo bom.
- **Platform admin:** não é PWA; é painel interno.

---

## 12. Tablet e Modo Operação

### 12.1 Princípio

**Um só código, breakpoints controlam layout.** Sem app separado, sem "mobile vs tablet app", sem duplicação.

### 12.2 Breakpoints

| Breakpoint | Dispositivo alvo | Layout do dashboard |
|---|---|---|
| `< 640px` (mobile portrait) | Celular | Bottom nav + agenda em lista vertical |
| `640–1023px` (tablet portrait / mobile landscape) | Transição | Layout híbrido |
| `>= 1024px` (tablet landscape / desktop) | Tablet balcão, desktop | Side nav + agenda em **colunas por profissional** com timeline vertical por hora |

### 12.3 Customer público

Mobile-first puro. Breakpoints cobrem tablet/desktop naturalmente — sem layout especial.

### 12.4 Modo Operação (detalhes)

- Toggle liga/desliga pelo dashboard.
- Estado salvo em `localStorage` do dispositivo (não global do tenant).
- Enquanto ativo:
  - UI simplificada (só agenda + status).
  - Wake Lock API evita tela dormindo.
  - Auto-refresh via Realtime (ver 10.10).
  - Botão "Sair" pede PIN.
- PIN:
  - Configurado em `/dashboard/configuracoes/operacao`.
  - 4 dígitos.
  - Armazenado em `tenants.operationModePinHash` (bcrypt).
  - Troca quando owner quiser.

---

## 13. Estrutura de código

### 13.1 Árvore de pastas

```
ara-barber/
├── src/
│   ├── app/
│   │   ├── (public)/                      # host = {slug}.aralabs.com.br
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── book/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── service/page.tsx
│   │   │   │   ├── professional/page.tsx
│   │   │   │   ├── date/page.tsx
│   │   │   │   ├── time/page.tsx
│   │   │   │   └── confirm/page.tsx
│   │   │   ├── my-bookings/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── auth/callback/route.ts
│   │   ├── (salon)/
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx               # agenda do dia
│   │   │   │   ├── agenda/page.tsx
│   │   │   │   ├── clientes/page.tsx
│   │   │   │   ├── profissionais/page.tsx
│   │   │   │   ├── servicos/page.tsx
│   │   │   │   ├── relatorios/page.tsx
│   │   │   │   ├── configuracoes/
│   │   │   │   │   ├── branding/page.tsx
│   │   │   │   │   ├── horarios/page.tsx
│   │   │   │   │   ├── equipe/page.tsx
│   │   │   │   │   └── operacao/page.tsx  # PIN do Modo Operação
│   │   │   │   └── onboarding/page.tsx
│   │   │   └── login/page.tsx
│   │   ├── (platform)/
│   │   │   ├── platform/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── tenants/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       └── billing/page.tsx
│   │   │   │   └── plans/page.tsx
│   │   │   └── login/page.tsx
│   │   ├── api/
│   │   │   └── manifest/[slug]/route.ts
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   ├── middleware.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts
│   │   │   ├── browser.ts
│   │   │   ├── service-role.ts
│   │   │   └── types.ts
│   │   ├── tenant/
│   │   │   ├── resolve.ts
│   │   │   ├── context.ts
│   │   │   └── branding.ts
│   │   ├── auth/
│   │   │   ├── guards.ts
│   │   │   ├── roles.ts
│   │   │   └── session.ts
│   │   ├── billing/
│   │   │   ├── trial.ts
│   │   │   ├── plans.ts
│   │   │   └── status.ts
│   │   ├── booking/
│   │   │   ├── availability.ts
│   │   │   ├── create-appointment.ts
│   │   │   └── status-machine.ts
│   │   └── validation/
│   │       └── schemas.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── booking/
│   │   ├── agenda/
│   │   ├── branding/
│   │   ├── operation-mode/
│   │   └── pwa/
│   ├── styles/
│   │   └── themes.ts
│   └── types/
│       └── domain.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_schema.sql
│   │   ├── 0002_rls_policies.sql
│   │   ├── 0003_helper_functions.sql
│   │   ├── 0004_pg_cron_jobs.sql
│   │   ├── 0005_seed_default_plan.sql
│   │   └── 0006_audit_log.sql
│   ├── tests/
│   │   └── rls_isolation.test.sql
│   ├── functions/
│   └── config.toml
├── public/
│   ├── icons/
│   └── robots.txt
├── docs/
│   └── superpowers/
│       └── specs/
├── e2e/
│   └── booking.spec.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── .env.local.example
├── .env.local
├── CLAUDE.md
└── README.md
```

### 13.2 Convenções

#### Server Actions vs Route Handlers

- **Default: Server Actions** em `app/**/actions.ts` ou inline.
- **Route Handlers** (`/api/*`) só quando:
  - Consumido por cliente externo (manifest dinâmico, webhook futuro).
  - Método HTTP específico ou streaming.

#### 3 clientes Supabase

| Cliente | Quando usar | Escapa RLS? |
|---|---|---|
| `createBrowserClient` | client components | Não (anon + sessão) |
| `createServerClient` | server components, server actions, route handlers | Não (anon + sessão) |
| `createServiceClient` | jobs, leitura pública | **Sim** — server-only |

#### Tipagem

- Tipos do banco gerados: `supabase gen types typescript` → `src/lib/supabase/types.ts`.
- Re-exports domain-friendly em `src/types/domain.ts`.
- Nunca tipar linha do banco à mão.

#### Validação

- Zod em **toda** mutation.
- Schemas em `src/lib/validation/schemas.ts`.
- Server actions retornam `Result<T, ValidationError | DomainError>`.
- **Nunca confiar em `tenantId` vindo do cliente** — sempre usa resolvido pelo middleware.

#### Theming por tenant

- Tenant tem `primaryColor`, `secondaryColor`, `accentColor` em hex.
- Layout injeta CSS vars no `<html>` baseado no tenant atual.
- Tailwind 4 usa `@theme` com vars CSS dinâmicas.
- Sem rebuild — tudo runtime via server components.

---

## 14. Testes

### 14.1 Testes de RLS (crítico)

- **Ferramenta:** pgTAP ou `supabase db test`.
- **Arquivo:** `supabase/tests/rls_isolation.test.sql`.
- **Casos obrigatórios por tabela com `tenantId`:**
  - Staff do tenant A não consegue SELECT de tenant B.
  - Staff do tenant A não consegue INSERT com tenantId de tenant B.
  - Staff do tenant A não consegue UPDATE linha de tenant B.
  - Customer vê só seus próprios appointments (em qualquer tenant).
  - Platform admin vê tudo.
  - Anônimo vê nada (exceto dados intencionalmente públicos via server action).
- Rodam no CI a cada PR.

### 14.2 Testes unitários (Vitest)

Alvos principais:
- `lib/booking/availability.ts` — cálculo de slots.
- `lib/booking/status-machine.ts` — transições válidas/inválidas.
- `lib/billing/trial.ts` — expiração, grace period, transições.
- `lib/booking/create-appointment.ts` — validação + detecção de conflito.

### 14.3 Testes E2E (Playwright)

Cenários mínimos:
- Customer agenda via public (Google login mockado → seleção → confirma).
- Staff faz login e vê agenda do dia.
- Staff cria appointment manual.
- Staff faz check-in → start → complete.
- Platform admin cria tenant e convida owner.

Rodam contra Supabase local (docker-compose) com seed reproduzível.

### 14.4 PWA

- Smoke manual em iPhone + Android + tablet Android.
- Verifica: install prompt, manifest válido, ícone correto, theme color aplicado.
- Lighthouse PWA score mínimo no CI.

---

## 15. Segurança

### 15.1 Autenticação
- Cookies httpOnly + SameSite=Lax.
- Senhas nunca em log.
- Magic link expira em 1h.
- Rate limit no login via Supabase.

### 15.2 Autorização
- Server actions revalidam sessão (não confiam só em cookie).
- `assertStaff()`, `assertPlatformAdmin()` obrigatórios nas sensíveis.
- RLS no banco como fallback.

### 15.3 Input
- Zod em toda mutation.
- Rejeita `tenantId` do cliente.
- Uploads validam MIME, tamanho, extensão; logos/fotos passam por verificação básica.

### 15.4 Secrets
- Service role key **nunca** no bundle client (CI grep no `/.next/static/`).
- `.env.local` no `.gitignore`.
- Env de produção via Vercel Dashboard.

### 15.5 Headers
- CSP restritiva (script-src self + Supabase + Vercel).
- HSTS 1 ano.
- X-Frame-Options DENY.
- Cookie Secure em prod.

### 15.6 Backup
- Enquanto no Supabase Free: GitHub Action semanal com `pg_dump` + upload para Cloudflare R2 ou S3.
- Ao subir para Supabase Pro: backup diário automático + ponto-no-tempo.

---

## 16. Observabilidade

### 16.1 Logs
- Vercel logs para server-side.
- Supabase logs (1 dia no Free, 7 no Pro).
- Console estruturado (JSON) em pontos críticos.

### 16.2 Audit log em DB
- Tabela `audit_log` preenchida por trigger em ações sensíveis:
  - Criar/cancelar/reagendar appointment.
  - Mudar branding.
  - Mudar plano/trial do tenant.
  - Criar/suspender tenant (platform admin).

### 16.3 Métricas de negócio (internas no app)

Em `/dashboard/relatorios` (por tenant):
- Total de agendamentos / período.
- Taxa de comparecimento / no-show.
- Agendamentos por profissional.

Em `/platform` (Aralabs) — **operacional**:
- Contagem por `billingStatus`.
- Agendamentos totais por tenant.
- Tenants criados no período.

Em `/platform` (Aralabs) — **billing (Fase 1):**
- **Tenants em TRIALING** (total + lista com dias restantes).
- **Trials expirando nos próximos 7 dias** (lista com data exata e dias restantes; para ação proativa do admin).
- **Tenants em PAST_DUE** (precisam de ação — cobrança, estender trial, ou suspender).
- **Tenants SUSPENDED** (inativos).
- **Tenants ACTIVE** (pagantes).
- **Tenants CANCELED** (arquivados).
- **Distribuição por plano** (quantos tenants em cada plano).
- **MRR projetado:** soma de `monthlyPriceCents` dos tenants em `ACTIVE`.
- **ARR projetado:** MRR × 12.
- **Taxa de conversão de trial** (acumulada): `(ACTIVE criados por trial) / (trials terminados)` × 100.
- **Novos tenants por período** (dia / semana / mês).
- **Timeline de billing_events** (últimos eventos importantes: suspensões, ativações, cancelamentos).

Em `/platform` (Aralabs) — **billing efetivo (Fase 2+):**
- **MRR efetivo** (receita realmente recebida de mensalidade).
- **Receita de taxa transacional** (acumulado recebido via split no período).
- **Receita total** (mensalidade + taxa).
- **Churn rate**.
- **LTV** (receita média por tenant ao longo de sua vida).
- **Tenants em inadimplência ativa** (falhas recentes de cobrança).

### 16.4 Erros no cliente
- Sem Sentry na Fase 1.
- Next.js `error.tsx` por rota captura e loga via server.
- Error boundary amigável em mobile com botão "recarregar".

---

## 17. CI/CD

- **GitHub Actions:**
  - Lint + typecheck em todo PR.
  - Vitest em todo PR.
  - pgTAP RLS tests em todo PR (Supabase local em docker).
  - Playwright smoke em PR para `main`.
  - Vercel preview automático em PR.
  - Vercel prod automático em merge para `main`.
- **Supabase migrations:** `supabase db push` via CLI ou MCP após revisão manual.

---

## 18. Custos estimados

### Desenvolvimento / validação (sem cliente real)
- Supabase Free: R$ 0
- Vercel Hobby: R$ 0
- Domínio `.com.br`: ~R$ 40/ano (~R$ 3/mês)
- **Total: ~R$ 3/mês**

### Produção inicial (primeiros clientes pagantes)
- Supabase Pro: $25/mês (~R$ 130) — ativar ao ter primeiro cliente real ou ao precisar de backup automático.
- Vercel Pro: $20/mês (~R$ 100) — só se bandwidth do Hobby estiver apertando.
- Domínio: R$ 3/mês.
- **Total: R$ 130–230/mês**, escala até dezenas de tenants.

### Break-even
- Se mensalidade do plano Starter = R$ 49: 3 clientes pagantes cobrem Supabase Pro.
- Se Pro = R$ 149: 1 cliente pagante já paga toda a infra.

---

## 19. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Esquecer policy RLS em nova tabela | Vazamento de dados entre tenants | Convenção de PR + pgTAP obrigatório no CI |
| Next.js 16 pós training-cutoff | Código errado gerado por agent | `CLAUDE.md` + consulta obrigatória a context7 antes de codar |
| Supabase Free pausar projeto | Site fora do ar | Monitorar atividade; migrar para Pro quando tiver cliente real |
| Perda de dados sem backup | Catastrófico | Backup manual semanal via GitHub Action enquanto no Free |
| Customer com duas contas confundir-se | Dados inconsistentes | `customers.userId` único por `(userId, tenantId)` |
| Cold start do Supabase Auth em PWA iOS | UX ruim no primeiro load | Aceitar na Fase 1; monitorar métricas |
| DNS/SSL de wildcard falhar | Todos os tenants fora | Vercel cuida; monitorar via UptimeRobot/health check |

---

## 20. Próximos passos (após este spec)

1. **Plano de implementação** (writing-plans skill) — decompor Fase 1 em épicos e tasks ordenadas.
2. **Bootstrap do projeto** — criar repositório, Next.js 16 scaffolding, Supabase config, Vercel setup.
3. **Migrations iniciais** — schema + RLS + helpers + pg_cron + seed de plano default.
4. **Infra de testes** — Vitest + Playwright + pgTAP.
5. **Implementação por épicos** (ordem sugerida):
   1. Auth + user_profiles + guards + roles.
   2. Tenants + middleware de host + branding.
   3. Cadastros (professionals, services, customers, business_hours).
   4. Agenda + availability + create appointment manual.
   5. Public booking wizard + customer auth flow.
   6. Status transitions (check-in, start, complete, cancel, no-show).
   7. Realtime + Modo Operação + PWA.
   8. Platform admin + billing management.
   9. Audit log + polish + hardening.
6. **Deploy dev → staging → prod.**

---

## 21. Fora de escopo (reafirmado)

Fica para Fases 2+ por decisão explícita:

- Pagamento real (Pix, cartão, webhook, split, reembolso).
- Comunicação (SMS, WhatsApp, lembretes automáticos, e-mail transacional).
- Registro de comissões por atendimento.
- Financeiro consolidado.
- Política de cancelamento com retenção.
- DeviceLoan (comodato de tablet — controle administrativo).
- Custom domain por tenant (feature completa; só campo no schema na Fase 1).
- Multiunidade, fidelidade, campanhas, marketplace.
- Sentry, feature flags, testes de carga.
- Offline-first robusto.
- NF-e, NFS-e, integrações fiscais.
