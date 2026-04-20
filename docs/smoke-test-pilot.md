# Smoke test — piloto (Spec 1)

Roteiro manual pra validar o fluxo ponta-a-ponta do piloto antes de soltar pra um salão real.
Use `barbearia-teste` e `bela-imagem` como tenants de referência.

URLs locais:

- `http://barbearia-teste.lvh.me:3008`
- `http://bela-imagem.lvh.me:3008`

> Pré-condição: `pnpm dev` rodando na porta 3008 + projeto Supabase `ara-barber-dev` com seed aplicado.

## Credenciais de teste

**Staff (login em `/salon/login`):**

| Tenant | Email | Senha | Role |
| --- | --- | --- | --- |
| barbearia-teste | `dono@barbearia-teste.test` | `barber1234` | SALON_OWNER |
| bela-imagem | `dono@bela-imagem.test` | `bela1234` | SALON_OWNER |

**Cliente final:** use um e-mail real (o OTP chega por email), ex: `thiagodevtavares@gmail.com`.

---

## 1. Home pública do tenant

- [ ] Abrir `http://barbearia-teste.lvh.me:3008/` em anônimo.
- [ ] Logo, headline e cores do tenant aparecem (branding por CSS vars).
- [ ] CTA "Agendar agora" visível.
- [ ] "Já sou cliente? Entrar" abre bottom sheet com login.
- [ ] Tab bar inferior com 4 itens (Início, Agendar, Reservas, Perfil) fixada.

## 2. Wizard de booking (cliente novo)

- [ ] Clicar "Agendar agora" vai para `/book`.
- [ ] `/book` lista só serviços ativos do tenant, vindos do Supabase.
- [ ] Selecionar um serviço → `/book/profissional`.
- [ ] Aparecem profissionais que atendem o serviço + opção "Qualquer profissional".
- [ ] Seleção → `/book/data`. Grid de 14 dias; dias sem business_hours/availability aparecem acinzentados.
- [ ] Selecionar dia aberto → `/book/horario`. Grid de slots a cada 30min.
- [ ] Slots passados (no mesmo dia) não aparecem.
- [ ] Slots indisponíveis (conflito ou bloqueio) aparecem **riscados/acinzentados** e não clicáveis.
- [ ] Selecionar horário livre → `/book/login` (usuário não autenticado).
- [ ] Digitar e-mail + recebe OTP (checar inbox real do Supabase Auth).
- [ ] Preencher 6 dígitos → redireciona `/book/confirmar` com resumo.
- [ ] Preencher nome/telefone, clicar "Confirmar reserva" → Supabase grava `appointments` com snapshot e `customers.consent_given_at`.
- [ ] `/book/sucesso?appointmentId=…` mostra card da reserva.

## 3. Customer já logado

- [ ] Voltar na home: card "Bem-vindo, Nome" + botão "Minhas reservas".
- [ ] `/meus-agendamentos` mostra a reserva criada em "Próximos".
- [ ] Badge de status "Marcado" (SCHEDULED).
- [ ] Botão "Cancelar" aparece se ainda estiver dentro da janela de cancelamento do tenant.
- [ ] Clicar Cancelar → confirm → status vira "Cancelado", aparece em "Histórico".
- [ ] Tentar cancelar fora da janela (alterar `cancellation_window_hours` pro teste) retorna erro.

## 4. Conflito de horário

- [ ] Como cliente 1: criar reserva `hoje 15:00` pro profissional X.
- [ ] Em anônimo (ou outro cliente): voltar em `/book/horario` pro profissional X.
- [ ] O slot `15:00` aparece **riscado/disabled** (não clicável).
- [ ] Se forçado via request direto, o server action `createAppointment` retorna "Horário não disponível. Escolha outro.".

## 5. Staff — agenda

- [ ] `http://barbearia-teste.lvh.me:3008/salon/login`, logar como staff seeded.
- [ ] `/salon/dashboard` (início): próximo atendimento + estatísticas do dia.
- [ ] `/salon/dashboard/agenda` lista os appointments do dia, ordenados por hora.
- [ ] Day switcher navega ontem/amanhã via `?date=YYYY-MM-DD`.
- [ ] Abrir detalhe: ações disponíveis obedecem `canTransition` (Confirmar, Finalizar, Não veio, Cancelar).
- [ ] Ao transicionar, UI atualiza sem reload total (router.refresh).
- [ ] Realtime: criar um appointment via wizard em outra aba/navegador; agenda do staff atualiza sozinha em ≤2s.

## 6. Staff — cadastros

- [ ] `/salon/dashboard/profissionais`: criar, desativar, reativar (`is_active` persiste no DB).
- [ ] `/salon/dashboard/servicos`: criar novo serviço; aparece no wizard de booking.
- [ ] `/salon/dashboard/clientes`: lista read-only; cliente criado no passo 2 aparece.

## 7. Staff — disponibilidade & horários

- [ ] `/salon/dashboard/configuracoes/horarios`: mudar um dia pra fechado → o wizard bloqueia este weekday.
- [ ] `/salon/dashboard/equipe-servicos`: desvincular profissional de um serviço → ele some de `/book/profissional`.
- [ ] `/salon/dashboard/disponibilidade`: adicionar bloqueio (ex: amanhã 14-17h) → os slots neste intervalo aparecem disabled em `/book/horario`.
- [ ] Editar jornada semanal de um profissional: remover segunda → `/book/data` desativa segundas pra ele.

## 8. LGPD

- [ ] `/perfil` como cliente: botão "Baixar meus dados" faz download JSON.
- [ ] Arquivo contém: customer row + lista de appointments + snapshot do tenant.
- [ ] "Política de privacidade" abre página branded.
- [ ] "Apagar minha conta neste salão" pede confirmação digitando "APAGAR":
  - Cancela reservas futuras do cliente.
  - `customer.name/phone/email/user_id/notes` zerados, `deleted_at` preenchido.
  - `customer_name_snapshot` dos appointments antigos vira "Cliente removido".
  - Sessão expira, redireciona pra home.
- [ ] Tentar logar de novo com o mesmo email: cria **novo** customer row (flow normal) — apagado anterior fica isolado.

## 9. Fora de escopo — stubs

- [ ] `/salon/dashboard/operacao`, `/financeiro`, `/relatorios`, `/perfil` (salão) exibem card "Em breve".
- [ ] `/mais` não mostra links para essas seções (mas rotas funcionam se acessadas direto).
- [ ] FAB speed dial não tem "Novo agendamento" (walk-in out of scope).

## 10. Smoke técnico

- [ ] `pnpm typecheck` limpo.
- [ ] `pnpm test` verde (8 suites, 79 testes).
- [ ] `pnpm lint` zero errors (os warnings restantes são de `console` em `customer-client.ts`, pré-existentes).
- [ ] `pnpm build` completa sem erro.

## Reset entre runs

```sql
-- roda no SQL do projeto ara-barber-dev, via MCP:
delete from appointments where tenant_id in (
  select id from tenants where slug in ('barbearia-teste','bela-imagem')
);
-- pra zerar customers criados pelo piloto manualmente:
update customers set deleted_at = now(), user_id = null, email = null, phone = null, name = null
  where tenant_id in (select id from tenants where slug in ('barbearia-teste','bela-imagem'));
```

Se quiser reset profundo, rodar novamente o seed de profissionais/serviços via arquivos em `supabase/seed` (ainda TODO — Épico 10).

## Known bugs do piloto

Listar aqui assim que descobrir — tudo que não for P0 vira task do Épico 10.
