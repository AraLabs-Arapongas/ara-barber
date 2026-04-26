# Revamp do Admin do Negócio — Design Spec

**Data:** 2026-04-26
**Autor:** Thiago + Claude
**Status:** aprovado, pronto pra plano de implementação

---

## 1. Contexto

O admin atual (`/admin/dashboard/*`) tem base visual limpa, mobile-first e premium, mas o conteúdo das telas ainda é simples demais pro uso real de dono, recepção ou profissional operando um negócio baseado em horários. O painel pode ficar aberto no PC/tablet/celular durante o expediente; precisa ser uma central operacional, não uma tela de boas-vindas.

Este revamp transforma 5 telas top-level (Início, Agenda, Equipe, Serviços, Mais) e a estrutura inteira da Mais (5 seções, 14 sub-telas) em algo capaz de responder em segundos: **o que está acontecendo hoje? quem é o próximo? existe atraso? quanto está previsto? quais horários estão livres? o que precisa de atenção?**

Escopo: **Fase 1A + 1B do spec funcional original**, ambas em uma única spec, multi-commit.

---

## 2. Princípios de UX (do spec funcional original)

1. **Operação antes de configuração.** O admin prioriza o que acontece no dia (próximos atendimentos, atrasos, horários livres, clientes que chegaram, etc). Configurações vão pra Mais.
2. **O dono entende o dia em 5 segundos.** Cards do topo respondem: quantos atendimentos hoje, quem é o próximo, quanto está previsto, existe alerta, alguma ação agora.
3. **A agenda parece viva.** Lista cronológica com status, ações inline, atualização realtime.
4. **Empty states geram ação.** Sempre explicam o que falta + oferecem próxima ação clara (adicionar agendamento, copiar link, etc).
5. **Link público é ativo do negócio.** Aparece com destaque em Home, Mais, empty states e onboarding.

**Tom:** simples, brasileiro, direto, acolhedor. Vocabulário neutro pra qualquer vertical (evitar "salão", "barbearia"). Preferir "Link de agendamento" a "URL pública", "Cliente faltou" a "no-show", etc.

---

## 3. Decisões fixadas no brainstorming

| # | Tópico | Decisão |
|---|---|---|
| 1 | Escopo | Fase 1A + 1B do spec funcional, em uma única spec/branch, múltiplos commits agrupados por layer. |
| 2 | `appointment_status` enum | Mantém os 5 estados atuais (`SCHEDULED, CONFIRMED, COMPLETED, CANCELED, NO_SHOW`). "Atrasado" calculado em runtime (`status IN (SCHEDULED, CONFIRMED) AND start_at < now()`). `ARRIVED, IN_PROGRESS` + modo recepção viram **novo item #31 no Épico 10**. |
| 3 | Novo agendamento manual (staff) | Wizard completo client-side. Nova server action `getBookingContext(date_range)` devolve `{services, professionals, professional_services, business_hours, availability, blocks, appointments_no_range}` num único payload. Slot calculation roda no client. Action de criação faz re-check de conflito server-side. Cliente pode ser existente ou criado on-the-fly (nome + telefone, sem auth). |
| 4 | Categoria de serviço | Skip — vira **novo item #32 no Épico 10**. Tela Serviços lista flat sem categorias. |
| 5 | Visibilidade de serviço | Mantém `services.is_active` boolean. UI rotula como "Visível para clientes" / "Oculto". O 3-state (`Visível/Oculto/Pausado`) descrito no spec funcional fica como tech debt se uso real pedir distinção. |
| 6 | Regras de agendamento | 3 colunas novas em `tenants`: `min_advance_hours`, `slot_interval_minutes`, `customer_can_cancel`. `cancellation_window_hours` (já existe) entra na mesma UI. |
| 7 | Bloqueios | Migration: `availability_blocks.professional_id` vira NULL-able. NULL = vale pra todo tenant. Slot-calculator passa a checar `(professional_id = X OR professional_id IS NULL)`. Página central nova `/admin/dashboard/bloqueios`. |
| 8 | Home — alertas "Atenção" | Atrasados + Sem horário configurado. Não-confirmados continua no bloco dedicado existente (`PendingConfirmations`). "Horário livre das X às Y" fora de escopo (custo de slot-calculator no SSR). |
| 9 | Mais — telas novas | Build everything sem stubs: link público + QR, regras agendamento, bloqueios, marca/aparência, e-mails automáticos config, WhatsApp templates + helper, usuários e permissões, plano e cobrança (info-only — gestão real fica no `aralabs-storefront`), segurança (mudar senha + sessões). |
| 10 | Modo recepção/painel | Fora deste revamp. Vinculado ao item #31 do Épico 10 (depende de `ARRIVED`, `IN_PROGRESS`). |

---

## 4. Mudanças de schema

Branding já existe nas colunas `tenants.{logo_url, favicon_url, primary_color, secondary_color, accent_color, contact_phone, whatsapp, email, address_*, city, state, postal_code, home_headline_top, home_headline_accent}` — "Marca e aparência" e "Perfil público" são UIs novas sobre essas colunas.

### Migration M1 — regras de agendamento

```sql
alter table public.tenants
  add column min_advance_hours integer not null default 0
    check (min_advance_hours >= 0),
  add column slot_interval_minutes integer not null default 15
    check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  add column customer_can_cancel boolean not null default true;
```

Aplicar via `mcp__supabase__apply_migration` com nome `revamp_booking_rules`.

### Migration M2 — bloqueios tenant-wide

```sql
alter table public.availability_blocks
  alter column professional_id drop not null;

create index availability_blocks_tenant_window_idx
  on public.availability_blocks (tenant_id, start_at, end_at)
  where professional_id is null;
```

Aplicar via `mcp__supabase__apply_migration` com nome `revamp_blocks_tenant_wide`.

### Migration M3 — templates de mensagem editáveis

```sql
create table public.tenant_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in ('EMAIL', 'WHATSAPP')),
  event text not null check (event in (
    'BOOKING_CONFIRMATION',
    'BOOKING_CANCELLATION',
    'BOOKING_REMINDER',
    'BOOKING_THANKS',
    'SHARE_LINK',
    'CUSTOM'
  )),
  enabled boolean not null default true,
  subject text,         -- só EMAIL
  body text not null,   -- placeholders: {nome}, {servico}, {horario}, {profissional}, {link}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel, event)
);

create index tenant_message_templates_tenant_idx
  on public.tenant_message_templates (tenant_id);

alter table public.tenant_message_templates enable row level security;

create policy tenant_message_templates_staff_all on public.tenant_message_templates
  for all using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy tenant_message_templates_platform_admin on public.tenant_message_templates
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
```

Seed defaults para tenants existentes (idempotente):

```sql
insert into public.tenant_message_templates (tenant_id, channel, event, subject, body)
select t.id, c.channel, c.event, c.subject, c.body
from public.tenants t
cross join (values
  ('EMAIL',    'BOOKING_CONFIRMATION', 'Seu agendamento foi confirmado',  'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.'),
  ('EMAIL',    'BOOKING_CANCELLATION', 'Seu agendamento foi cancelado',   'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.'),
  ('EMAIL',    'BOOKING_REMINDER',     'Lembrete do seu agendamento',     'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.'),
  ('WHATSAPP', 'BOOKING_CONFIRMATION', null, 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}. Qualquer coisa, me avisa por aqui!'),
  ('WHATSAPP', 'BOOKING_REMINDER',     null, 'Oi {nome}, lembrete: você tem {servico} {horario}. Te espero!'),
  ('WHATSAPP', 'SHARE_LINK',           null, 'Oi! Agora você pode agendar comigo direto por aqui: {link}')
) as c(channel, event, subject, body)
on conflict (tenant_id, channel, event) do nothing;
```

Aplicar via `mcp__supabase__apply_migration` com nome `revamp_message_templates`.

### Mudanças de lógica (sem schema)

- `src/lib/booking/slots.ts` — slot-calculator passa a OR `professional_id IS NULL` ao consultar `availability_blocks`. Refatorado pra util shared (consumível tanto no server SSR quanto no wizard client-side).
- `src/app/admin/(authenticated)/actions/booking-context.ts` — nova server action `getBookingContext({ from, to, professional_ids? })` retorna o payload completo pro wizard manual.
- `src/lib/messaging/whatsapp.ts` — novo helper `buildWhatsappLink(phone, body, vars)` que faz template substitution e percent-encoding pra `wa.me/<phone>?text=<msg>`.
- `src/lib/admin/derivations.ts` — utils `isLate(appointment, now)`, `worksToday(professional, today)`, `hasNoSchedule(professional)`.
- `supabase/functions/on-appointment-event` — passa a ler do `tenant_message_templates` (com fallback pros defaults hard-coded de hoje) em vez de string fixa.

### Tipos TS

Após cada migration, rodar `mcp__supabase__generate_typescript_types` → atualiza `src/lib/supabase/types.ts`.

---

## 5. Mapeamento de rotas (existente × novo)

### Tab bar (top-level)

| Rota | Estado | Ação no revamp |
|---|---|---|
| `/admin/dashboard` (Home) | existe | revamp completo (cards do dia, ações rápidas, atenção) |
| `/admin/dashboard/agenda` | existe | revamp (filtros, resumo do dia, lista cronológica revisada, empty state acionável) |
| `/admin/dashboard/profissionais` (Equipe) | existe | revamp dos cards (trabalha hoje, agendamentos hoje, sem horário, serviços vinculados) |
| `/admin/dashboard/servicos` (Serviços) | existe | revamp (busca, visibilidade rotulada, profissionais vinculados no card) |
| `/admin/dashboard/mais` | existe | reorg em 5 seções com 14 entradas |

### Mais — sub-telas

#### 5.1 Meu negócio

| Item | Rota | Estado |
|---|---|---|
| Perfil público | `/admin/dashboard/perfil` | existe — revamp (logo, nome, endereço, contato, Instagram, info públicas) |
| Link de agendamento | `/admin/dashboard/link` | **nova** — copiar, abrir página pública, gerar QR, baixar QR, compartilhar no WhatsApp |
| Marca e aparência | `/admin/dashboard/marca` | **nova** — edita branding cols de `tenants` (cores, logo, capa, headline da home) |

#### 5.2 Agenda

| Item | Rota | Estado |
|---|---|---|
| Horários de funcionamento | `/admin/dashboard/configuracoes/horarios` | existe — sem mudança nesta spec |
| Regras de agendamento | `/admin/dashboard/regras` | **nova** — 4 fields (antecedência mínima, intervalo, janela de cancelamento, permitir cancel cliente) |
| Bloqueios, folgas e feriados | `/admin/dashboard/bloqueios` | **nova** — tela central tenant-wide ou por profissional (substitui `availability-manager.tsx` que vivia no detalhe do profissional) |

#### 5.3 Gestão

| Item | Rota | Estado |
|---|---|---|
| Clientes | `/admin/dashboard/clientes` | existe — revamp (busca, card com histórico, detalhe, total concluído, ação "novo agendamento") |
| Financeiro | `/admin/dashboard/financeiro` | existe — revamp (filtro período, 4 cards Previsto/Realizado/Perdido/Ticket, por serviço, por profissional, movimentos) |
| Relatórios | `/admin/dashboard/relatorios` | existe — revamp (resumo operacional: agendamentos no período, serviços mais vendidos, profissionais mais ativos) |

#### 5.4 Comunicação

| Item | Rota | Estado |
|---|---|---|
| E-mails automáticos | `/admin/dashboard/comunicacao/emails` | **nova** — UI editor de templates EMAIL (toggle enabled, edit subject/body por evento) |
| WhatsApp | `/admin/dashboard/comunicacao/whatsapp` | **nova** — UI editor de templates WHATSAPP + integração nos cards de agendamento (botão "Enviar pelo WhatsApp") |
| Notificações da equipe | `/admin/dashboard/comunicacao/notificacoes` | refator do `StaffPushToggle` existente — agrupado na seção Comunicação, copy melhor ("Receba avisos de novos agendamentos neste dispositivo") |

#### 5.5 Conta

| Item | Rota | Estado |
|---|---|---|
| Usuários e permissões | `/admin/dashboard/conta/usuarios` | **nova** — lista staff do tenant + convidar (email + role) + mudar role + desativar |
| Plano e cobrança | `/admin/dashboard/conta/plano` | **nova** — info-only: trial restante, plano atual, valor mensal, histórico de cobranças, link "Falar com suporte". Gestão de plano real fica no `aralabs-storefront`. |
| Segurança | `/admin/dashboard/conta/seguranca` | **nova** — mudar senha + listar sessões ativas + revogar sessões |
| Sair | (form action) | existe |

### Rotas afetadas indiretamente

- `src/app/admin/(authenticated)/dashboard/disponibilidade/page.tsx` — hoje só redireciona pra `/profissionais`. Após revamp, redireciona pra `/admin/dashboard/bloqueios` (rota nova).
- `src/components/dashboard/availability-manager.tsx` — componente migra do detalhe do profissional pra rota central `/bloqueios`. Detalhe do profissional mantém só "horários de trabalho" (`professional_availability`).
- `src/components/dashboard/professional-detail.tsx` — refator pra remover a aba de bloqueios (agora central) e expor link "Ver bloqueios" → `/bloqueios?professional=<id>`.

---

## 6. Decomposição em commits

Princípio: cada commit é shippable isolado quando possível, reversível, e atualiza `docs/smoke-test-pilot.md` no mesmo commit conforme convenção do repo. **9 commits totais**, agrupados em 6 layers.

### Layer 0 — Schema + types

| # | Commit | Conteúdo |
|---|---|---|
| C1 | `feat(db): schema do revamp (regras + bloqueios tenant-wide + message templates)` | M1 + M2 + M3 + seed defaults + types regen |

### Layer 1 — Foundation (utils + actions, sem UI)

| # | Commit | Conteúdo |
|---|---|---|
| C2 | `feat(admin): foundation — slot util shared + getBookingContext + derivações + whatsapp helper` | refactor `lib/booking/slots.ts` pra util shared + nova action `getBookingContext` + utils `derivations.ts` + helper `buildWhatsappLink` |

### Layer 2 — Manual booking wizard

| # | Commit | Conteúdo |
|---|---|---|
| C3 | `feat(admin/agenda): wizard de criação manual client-side` | rota nova `/admin/dashboard/agenda/novo` com wizard {cliente, serviço, profissional, data, hora, confirmar}. Cliente novo pode ser criado on-the-fly (nome + telefone). |

### Layer 3 — Tab bar revamps

| # | Commit | Conteúdo |
|---|---|---|
| C4 | `feat(admin): revamp tab bar (Home + Agenda + Equipe + Serviços)` | 4 telas top-level com cards revisados, filtros, lista cronológica, empty states acionáveis, alertas "Atenção" |

### Layer 4 — Mais reorg + sub-telas (4 commits)

| # | Commit | Conteúdo |
|---|---|---|
| C5-1 | `feat(admin/mais): reorg base + Meu negócio` | Mais reorg em 5 seções estruturais + Perfil público revisado + Link de agendamento (copiar/QR/share) + Marca e aparência |
| C5-2 | `feat(admin/mais): Agenda + Gestão` | Regras de agendamento + Bloqueios central + Clientes revamp + Financeiro revamp + Relatórios revamp |
| C5-3 | `feat(admin/mais): Comunicação` | E-mails automáticos UI + WhatsApp templates + integração nos cards de agendamento + Notificações relabel |
| C5-4 | `feat(admin/mais): Conta` | Usuários e permissões + Plano e cobrança info-only + Segurança |

### Layer 5 — Integração + docs

| # | Commit | Conteúdo |
|---|---|---|
| C6 | `chore: edge-fn lê message templates + smoke test consolidado + Épico 10 #31/#32` | edge function `on-appointment-event` lê templates do DB com fallback + pasada final no smoke test + adicionar #31 (status enum + modo recepção) e #32 (categoria de serviço) no Épico 10 |

---

## 7. Tech debt gerado (vai pro Épico 10)

### #31 — Status enum operacional + modo recepção

**Origem:** decisão #2 deste revamp.

Adicionar `ARRIVED` e `IN_PROGRESS` ao `appointment_status` enum. Permite distinguir "cliente chegou na recepção" de "atendimento em andamento" e habilita o "Modo recepção/painel" descrito na seção 6.7 do spec funcional original. Requer:
- Migration `ALTER TYPE appointment_status ADD VALUE 'ARRIVED'` e `'IN_PROGRESS'`
- Botões na agenda: "Marcar como chegou", "Iniciar atendimento", "Concluir"
- Update das queries que filtram por status (active/pending lists)
- Modo recepção em `/admin/dashboard/painel` ou similar

### #32 — Categoria de serviço

**Origem:** decisão #4 deste revamp.

Permitir agrupar serviços por categoria (Cabelo, Barba, Unhas, Estética, Pacotes, etc) na tela Serviços e no booking público. Implementação sugerida:
- Adicionar coluna `category text` em `services` (free-text com autocomplete)
- Tela Serviços agrupa cards por categoria com header dobrável
- Public booking aplica mesmo agrupamento

---

## 8. Critérios de aceite

### Home

- [ ] Exibe resumo útil do dia (cards Agenda hoje + Próximo + Previsto + Status).
- [ ] Mostra próximo atendimento quando existir, com horário, serviço, profissional, cliente.
- [ ] Mostra previsto do dia em R$ (somando services × appointments ativos).
- [ ] Tem ações rápidas operacionais (Novo agendamento, Abrir agenda, Copiar link, Bloquear horário).
- [ ] Seção "Atenção" mostra atrasados e profissionais sem horário; quando vazia mostra "Tudo certo por enquanto.".
- [ ] Não prioriza ajustes/configurações (essas vivem em Mais).

### Agenda

- [ ] Exibe agenda por data com seletor (Hoje / Amanhã / Escolher data).
- [ ] Resumo do dia abaixo do seletor (N agendamentos · R$ X previsto · N atrasos).
- [ ] Filtros por profissional e por status (apenas estados disponíveis no enum atual).
- [ ] Lista cronológica de agendamentos com ações inline (ver detalhes, cancelar, concluir, marcar como faltou).
- [ ] Empty state acionável (Adicionar agendamento + Copiar link).
- [ ] Atualiza via realtime quando novos agendamentos chegam.
- [ ] Legível em desktop/tablet (max-width controlado, layout não estoura).

### Equipe

- [ ] Card de profissional exibe: nome, status (ativo/inativo), trabalha hoje (intervalo), N agendamentos hoje, R$ previsto, serviços vinculados, acesso ao painel.
- [ ] Indica quando profissional está sem horário configurado.
- [ ] Permite acessar/editar profissional (link pra `/profissionais/[id]`).
- [ ] Resumo do header (N trabalhando hoje · N com agenda cheia ou similar).

### Serviços

- [ ] Exibe duração, preço, visibilidade ("Visível para clientes" / "Oculto") e profissionais vinculados no card.
- [ ] Permite busca por nome.
- [ ] Empty state acionável (Adicionar serviço).

### Mais

- [ ] Organiza configurações em 5 seções (Meu negócio, Agenda, Gestão, Comunicação, Conta).
- [ ] Contém entradas pra: Clientes, Financeiro, Relatórios, Link de agendamento, Horários, Regras de agendamento, Bloqueios, Plano e cobrança, etc.
- [ ] Plano e cobrança fica separado de Financeiro (são domínios diferentes).
- [ ] Botão Sair preservado.

### Financeiro

- [ ] Acessado por Mais > Gestão.
- [ ] Filtro de período (Hoje / Esta semana / Este mês / Personalizado).
- [ ] 4 cards: Previsto, Realizado, Perdido, Ticket médio.
- [ ] Resumo por serviço e por profissional (top N).
- [ ] Movimentos recentes (lista de appointments com valor e status).
- [ ] Disclaimer claro: valores baseados em agendamentos + status, não em pagamentos reais.

### Wizard manual

- [ ] Staff cria appointment sem precisar do fluxo público OTP.
- [ ] Cliente pode ser existente (busca por nome/telefone) ou criado on-the-fly.
- [ ] Slots calculados client-side a partir do `getBookingContext`.
- [ ] Submit faz re-check de conflito server-side.

### Bloqueios

- [ ] Tela central lista bloqueios cross-professional.
- [ ] Permite criar bloqueio "todos os profissionais" (NULL) ou específico.
- [ ] Slot-calculator respeita ambos os tipos.

### WhatsApp

- [ ] Botão "Enviar pelo WhatsApp" no card do agendamento abre `wa.me/...` com mensagem pré-preenchida do template do tenant.
- [ ] Botão "Compartilhar link" na tela Link de agendamento usa o template `SHARE_LINK`.
- [ ] Templates editáveis em Mais > Comunicação > WhatsApp.

### E-mails

- [ ] Edge function `on-appointment-event` lê do `tenant_message_templates` com fallback pros defaults hard-coded.
- [ ] Toggle `enabled` na UI desabilita o envio do template correspondente.

---

## 9. Fora de escopo deste revamp

(Reuse seção 20 do spec funcional original.)

- Pagamento real (gateway, split, payout, comissão, fechamento de caixa, contas a pagar, fiscal, conciliação).
- WhatsApp Business API (este revamp faz só assistido via `wa.me/...`).
- CRM avançado, campanhas automáticas, lembretes de retorno por SMS.
- Modo recepção/painel completo (vai com #31).
- Categorias de serviço (vai com #32).
- Migração da UI platform admin pro `aralabs-storefront` (item #14 do Épico 10, fora deste repo).

---

## 10. Próximos passos

1. **User aprova esta spec.**
2. Invocar skill `superpowers:writing-plans` pra escrever plano de implementação detalhado em `docs/superpowers/plans/2026-04-26-admin-revamp.md` (com tasks por commit, steps numerados, files afetados, validação).
3. Executar plano via `superpowers:executing-plans` (commit por commit, com smoke test em cada).
