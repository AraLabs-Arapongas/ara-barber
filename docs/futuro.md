# Futuro do ara-agenda

> Produto vivo. Cada item nasce como ideia, vira decisão, vira plano,
> vira código. Atualize ao longo das conversas — não deixe acumular.
>
> **Não confundir com:**
>
> - `docs/superpowers/plans/` — planos executáveis (checklist por fase).
> - `docs/superpowers/specs/` — design técnico de feature.
>
> Este doc é o nível acima: pensamento de produto, decisões adiadas,
> backlog priorizado. Quando algo daqui virar plano executável, criar
> doc em `plans/` e linkar aqui.

---

## Decisões tomadas

_Cronológico inverso (mais recente primeiro). Cada item: data, decisão, razão curta, link pro commit/PR se houver._

- **2026-05-01 — Pricing oficial: R$ 79/mês após 60d trial.**
  Saiu de placeholder pra confirmado. 1º cliente piloto começa esta
  semana (validação). Contrato + termos ainda em fechamento mas
  pricing já é oficial pra qualquer comunicação. Ver entrada
  "Bloqueadores reais pro launch do piloto" — itens #4 (acordo) e
  #7 (cobrança dia 61) seguem pendentes mas não bloqueiam soft
  launch da landing.
  **Multi-profissional definido (2026-05-02):** R$ 79/mês inclui até
  10 profissionais. R$ 19,90 por profissional adicional. Justificativa
  no custo: infra é dominada por overhead fixo (~R$ 257/mês Vercel +
  Supabase), variável por tenant é R$ 2-25/mês mesmo no caso grande,
  margem fica >70% em qualquer cenário. Modelo cobre 95%+ do beachhead
  (barbearia/salão típico = 2-5 prof) sem fricção e captura valor de
  equipes grandes (rede de 15 = R$ 178; ainda bate Trinks/Booksy).
  Landing reflete em Hero, Pricing card, FAQ #5 e meta description.
  **Cota aplicada no produto (2026-05-02):** migration
  `20260502000001_plans_professional_quota.sql` adiciona
  `plans.included_professionals` (default 10) e
  `plans.extra_professional_price_cents` (default 1990). Helper
  `getProfessionalUsage()` em `lib/billing/`. Tela `/profissionais`
  mostra banner de uso ("8 de 10 inclusos" / "12 ativos = +R$
  39,80/mês"). Adicionar/reativar acima da cota dispara modal
  obrigatório com checkbox de consentimento (audit trail pra quando
  cobrança real entrar). Excluir só funciona em inativo sem histórico
  (FK preserva relatórios).
  **Pioneiros (2026-05-02):** janela "até 31/07/2026" (data fixa, não
  "primeiros N"). Quem aderir nesse período: 60 dias grátis + selo
  "Pioneiro" permanente no perfil público. Selo precisa ser
  implementado: campo `tenants.is_pioneer boolean` + render no header
  da home pública do tenant. **Pendente:** migration do flag, lógica
  de marcar automaticamente tenants criados antes de 2026-08-01,
  componente visual do selo.

- **2026-05-01 — Landing page do produto + demos públicas.**
  Decisão: `aralabs.com.br/ara-agenda` (path no storefront, marca-mãe
  AraLabs forte; subdomínio dedicado entra se virar spin-off).
  Estrutura: Hero + "Veja em ação" (3 demos clicáveis) + verticais +
  features + preço + FAQ + CTA. Soft launch (noindex) até 1º piloto
  rodar 30d. Demos: barbearia, consultório, lava-jato — provam
  versatilidade vertical-neutral. Cron diário reseta dados dos demos
  (cliente pode reservar de verdade pra testar fluxo completo, banner
  avisa). Mora no repo `aralabs-storefront`.

- **2026-04-30 — Platform admin em produção.**
  `https://admin.aralabs.com.br` operacional com user
  `admin@aralabs.com.br` (role `PLATFORM_ADMIN`). Telas: Dashboard
  (MRR, counts, trials vencendo), Tenants (list/new/detail/edit
  branding/change status), Plans CRUD inline, Users cross-tenant
  (reset senha, desativar), Audit log viewer. Subdomínio dedicado
  via route group `src/app/(platform)/`, auth com magic link
  (Supabase OTP via `signInWithOtp` PKCE), guard
  `assertPlatformAdmin()` em layer dupla (layout + cada
  `lib/platform/*` query/mutation), todas mutations gravam em
  `audit_log`. Provisioning de tenant extraído de
  `scripts/provision-tenant.ts` pra `lib/platform/provision.ts`
  compartilhado entre CLI e UI. Substitui a entrada anterior "Admin
  AraLabs no storefront: postergado" — agora postergado é só o **hub
  multi-produto** (gatilho de reabrir: chegada do `ara-X`); UI
  cross-tenant pro ara-agenda existe aqui. Plano executado:
  `docs/superpowers/plans/2026-04-29-platform-admin.md`.

  **Gotchas registrados pra próxima vez:**
  - Não criar `auth.users` via SQL direto — falta de
    `auth.identities` properly populated leva a 422 "Signups not
    allowed for otp" mesmo com user existindo. Use
    `auth.admin.createUser()` via script JS ou MCP/dashboard.
  - Em dev local, `supabase/config.toml` precisa
    `additional_redirect_urls = ["http://*.lvh.me:3008/**", ...]`
    com glob pra Supabase aceitar redirect pra subdomínios.
  - Subdomínio `admin` foi removido da lista
    `RESERVED_SUBDOMAINS` em `lib/tenant/resolve.ts` pra resolver
    em area `platform`.

- **2026-04-29 — Admin AraLabs no storefront: postergado.**
  Brainstorm de design multi-produto rolou (switcher + Overview
  consolidado + audit por produto), mas implementação foi
  **postergada** porque hoje só existe 1 produto (`ara-agenda`).
  Construir hub multi-produto agora = infra nova (auth próprio,
  N secret clients, `admin_users` table) pra resolver problema que
  ainda não existe. Enquanto for produto único, **admin mora dentro
  do próprio `ara-agenda`** sob `/admin/platform/*` com guard
  `assertPlatformAdmin` — zero infra nova, lógica de write
  co-localizada com o produto. Spec da arquitetura multi-produto
  fica como análise de terreno em
  `aralabs-storefront/docs/superpowers/specs/2026-04-29-admin-multiproduct-design.md`
  (commit `1d1071c`, status "Postergado"); reabrir quando `ara-X`
  entrar em planejamento. Spec antigo do hand-off
  (`docs/superpowers/specs/2026-04-19-platform-admin-handoff.md`)
  fica como referência de longo prazo. Ver também: "Decisões
  adiadas" abaixo.

- **2026-04-29 — Sinalização "atrasado" removida da home staff.**
  Sem estado ARRIVED no enum, todo CONFIRMED com horário passado
  virava "atrasado" — incluindo cliente já sentado na cadeira sendo
  atendido. Confundia o staff. Removido `isLate`/`lateMinutes` em
  `lib/admin/derivations.ts`, kind `late` em `AttentionItem`, badge
  no DaySummary. Reabilitar quando ARRIVED/IN_PROGRESS entrarem
  no enum (épico 10 #31). Commit `96833e8`.

- **2026-04-29 — Combo bookings: cliente reserva N serviços numa
  ação.** Schema novo (`appointment_groups` + `appointments.group_id`/
  `position`); backward compat 100% (single bookings têm group_id null).
  Wizard cliente ganha steps "Ordem" (>1 serviço) e "Profissional"
  vira N pickers (1 por serviço). DateTime usa `computeComboSlots`
  novo que encadeia segments com buffer entre profs diferentes
  (`tenants.combo_buffer_minutes`, default 10, configurável). Confirm
  via RPC atômica `create_combo_booking` (valida conflito de cada
  segment antes de qualquer insert). Cancel via RPC
  `cancel_appointment_group` (cascata em transação). Cliente lista
  combo como 1 card com badge "🔗 Combo · N serviços". Spec:
  `docs/superpowers/specs/2026-04-29-combo-bookings-design.md`.

  **Fora do escopo desta entrega (registrar como tech debt):**
  - Detail page dedicada `/meus-agendamentos/combo/[groupId]` (combo
    hoje só tem card agregado na lista; click no card vai pra primeiro
    appointment do detail page atual).
  - Badge "🔗 Combo" nos cards do staff em `/admin/dashboard/agenda`.
  - Email único agregando segments do combo (hoje 1 email/segment).
  - Cancelamento parcial (Fase 2 — schema já comporta com `is_canceled`
    em `appointment_services` se virar feature).

- **2026-04-28 — Tech debt sweep: 4 itens fechados.**
  (1) **RLS perf optim**: wrap `auth.uid()` em `(select auth.uid())` em
  14 policies + indexa 4 FKs sem cobertura. Resolve advisor flags
  `auth_rls_initplan` e `unindexed_foreign_keys`. Migration 0027.
  (2) **Audit log**: tabela `audit_log` (RLS staff-only read; só
  service-role escreve) + helper `lib/audit/log.recordAudit()` integrado
  em createAppointment, cancelCustomerAppointment, createManualAppointment,
  updateBookingRules, deleteMyAccountForTenant. Migration 0028.
  (3) **pgTAP RLS isolation tests**: extensão habilitada (migration 0029) + suite `supabase/tests/database/rls_isolation.sql` com 11
  asserções cross-tenant (customer A não vê/altera dados de B). Roda
  via `pnpm test:rls`.
  (4) **Playwright em CI reabilitado**: smoke mínimo (proxy header +
  dev root index render) sem dependência de DB real. Job `e2e` no
  ci.yml com upload de report como artifact. Cobertura full-stack
  (login OTP, criar reserva) ainda é tech debt — exige projeto
  Supabase dedicado pra CI com secrets.

- **2026-04-28 — Upload de logo/favicon via Supabase Storage.**
  Antes era input de URL — exigia whitelist do domínio externo no
  `next.config.ts` (toda vez que tenant trocava o host quebrava).
  Agora: file upload pra bucket `tenant-assets` (público), URL
  pública sempre vive em `*.supabase.co/storage/...` (já whitelisted
  uma vez). Server action `uploadTenantAsset` valida role + tenant +
  mime + tamanho (5 MB). Path: `tenants/{id}/{kind}-{ts}.{ext}`.

- **2026-04-28 — UX revamp da área cliente (4 telas).**
  Home reordenada (próxima reserva > CTA > ações rápidas > funcionamento
  em accordion). Wizard `/book` com seleção visual mais clara
  (ring + check). Reservas com cores de status sólidas + ação
  "Reagendar" (link pré-preenchido pro wizard). Perfil agrupado em
  Conta + Privacidade, header compacto, copy mais leve. Sem mexer
  em backend — feature inteira é UI/copy.
  - "Reagendar" não cancela automaticamente; só redireciona pro
    wizard com serviço+profissional pré-preenchidos. Cliente cancela
    o original manualmente quando confirmar o novo. Mais seguro
    contra perda de slot.

- **2026-04-28 — Booking rules aplicadas no runtime.**
  `min_advance_hours` + `slot_interval_minutes` agora enforçados no
  `computeSlots()` (cliente respeita; staff respeita só o interval —
  pode bookar walk-in pra agora). `customer_can_cancel` validado em
  `cancelCustomerAppointment()`. Era TODO declarado em
  `booking-rules.ts:43`.

- **2026-04-28 — Sentry instalado pro monitoring de erros prod.**
  Free tier (5K errors/mês). Captura client + server + edge errors,
  source maps via `SENTRY_AUTH_TOKEN` quando setado. Sem performance
  tracing (Vercel Analytics cobre). Sem replay (custa quota separada).

- **2026-04-28 — Termos de uso criados + política de privacidade
  reforçada (LGPD).** Novas rotas `/termos-uso` + atualização de
  `/politica-privacidade` com bases legais, retenção, transferência
  internacional, cookies, DPO. Consent checkbox implícito no botão
  "Confirmar reserva" do wizard.

- **2026-04-28 — Script `pnpm provision-tenant` pra novos tenants.**
  Cria tenant + business_hours defaults + auth user + user_profile
  BUSINESS_OWNER + envia reset de senha. Substitui SQL manual via MCP.

- **2026-04-28 — Mobile nativo: não fazer no horizonte previsível.**
  PWA atual cobre 90% dos casos (push, install prompt, wake lock,
  câmera). Custo de manter 2-3 stacks paralelas + fee de app store
  (15-30% em in-app purchase) não compensa pro segmento SMB Brasil.
  Revisitar só se: (a) 1000+ tenants pagantes pedindo, ou (b)
  feature específica que **só** funciona nativo (NFC, hardware POS).

- **2026-04-28 — Wizard cliente single-page substitui multi-rota `/book/*`.**
  Padrão alinhado com wizard manual do staff. Login postergado pro
  step "Confirmar". Commit `b9bac0d`.

---

## Backlog priorizado (próximos 3-6 meses pós-MVP)

### Tier 1 — Alto valor, baixo-médio esforço

_(Vazio — itens anteriores resolvidos no sweep de 2026-04-28; ver Decisões.)_

### Tier 2 — Alto valor, alto esforço

- **Pagamento online + sinal antecipado (PIX).**
  Único feature que paga a si mesmo: reduz no-show drasticamente +
  gera transactional fee. Prioridade #1 de Fase 2. Schema já tem
  `services.deposit_required`, `deposit_value_cents`, `deposit_type`,
  `deposit_percentage` — precisa wiring + integração com PSP (Stripe,
  Mercado Pago, Asaas).

- **WhatsApp dispatch real via Z-API/Evolution API.**
  Status atual: edge function `on-appointment-event` aplica template
  mas WhatsApp só monta `wa.me/...?text=...` (cliente abre manual).
  Tradeoff custo/risco analisado:
  - **Z-API/Evolution** (~R$ 50-150/mês fixo): usa número que dono
    já anuncia, sem aprovar templates, risco de ban Meta baixo se
    respeitar volume + opt-in. **Recomendado pro beachhead.**
  - **WhatsApp Business API oficial** (Meta direto ou BSP como
    Twilio): R$ 0,05-0,30 por mensagem, profissional, mas templates
    precisam aprovação Meta. Vale só pra tenants grandes ou white-label.
    **Inclui também:** quando agendamento for criado/confirmado, mandar
    WhatsApp de confirmação (mesmo conteúdo que o email hoje) com link
    `.ics` ou web calendar (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`)
    pro cliente adicionar na agenda dele.

- **Lembrete 24h + 2h via WhatsApp.**
  Estrutura existe (`appointments.reminder_24h_sent_at`,
  `reminder_2h_sent_at`), falta dispatch real. Casa com item acima.

### Tier 3 — Marginal / experimental

- **Programa de fidelidade simples** (cliente N reservas → desconto
  no próximo). Forte retenção. Esforço médio. **Mockup já existe na
  home** atrás de feature flag `ara:flag:loyalty-stamps` (default ON).
  Pra virar real: migration `loyalty_stamps`, server query, configurar
  meta + recompensa por tenant em "Mais → Programa".

- **Marketing campaigns** (envio em massa, segmentação por última
  visita / vertical). Útil pra época baixa. Custo de mensagens.

- **Múltiplas unidades** (rede com tenant-pai). Mexe em RLS, queries,
  billing — alto esforço, segmento menor.

- **Branding white-label completo.** Campo `tenants.custom_domain` já
  existe no schema, falta wiring (cert SSL automático, DNS
  validation). Apelo principalmente de vaidade do dono.

---

## Decisões adiadas

_Coisas que viraram spec/análise mas a implementação foi adiada por razão concreta. Diferente de "Não vamos fazer" — aqui o gatilho de reabrir é claro._

- **2026-04-29 — Hub admin AraLabs no `aralabs-storefront`.**
  Spec pronta (switcher + Overview + audit por produto). Postergado
  enquanto só existe 1 produto — admin mora dentro do `ara-agenda`
  até o segundo produto justificar o hub. **Gatilho pra reabrir:**
  início do planejamento de `ara-X` (ou qualquer produto AraLabs #2).
  Spec:
  `aralabs-storefront/docs/superpowers/specs/2026-04-29-admin-multiproduct-design.md`.

---

## Ideias em aberto

_Brainstorm dump. Move pra Backlog quando virar concreto, ou pra "Não vamos fazer" quando descartar._

- **Modelo de pricing:** flat tier (free/pro/business) vs per-feature
  add-on (à la carte). Sem dado de mercado ainda — entrevistar
  tenants piloto antes de decidir.
- **Integração Google Calendar / iCal pro staff** — sincronizar
  agenda do staff com Google. Útil pra dono que já vive no Calendar.
- **Relatórios avançados** (cohort, LTV, churn). Utilidade duvidosa
  pro SMB que olha caixa do dia. Talvez só aparece quando subir pra
  segmento médio.
- **Auto-confirmação de reservas** (configurável: cliente cria →
  já vira CONFIRMED automaticamente, sem precisar staff aprovar).
  Reduz fricção pra negócios de alto volume / baixa criticidade.

---

## Não vamos fazer (com razão)

- **Mobile nativo** (decisão 2026-04-28). Custo > benefício; PWA cobre.
- **Multi-idioma / multi-moeda.** Escopo Brasil. Reabrir só se for
  expandir LATAM/global.
- **WhatsApp Business API oficial pra todos os tiers.** Caro pra
  volume baixo do beachhead. Z-API é o caminho. Reservar oficial pra
  tenants enterprise futuros.

---

## Conversas relevantes

_Links pra discussões importantes em PRs, issues, ou notas em sessões anteriores._

- 2026-04-27 — análise de WhatsApp dispatch (3 vias, Z-API recomendado) e premium tiers (sessão Claude).
