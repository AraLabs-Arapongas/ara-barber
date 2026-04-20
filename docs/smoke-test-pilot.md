# Smoke test — piloto (Spec 1)

> **Manutenção:** sempre que um fluxo mudar (novas telas, rotas, ações, guards, rules de negócio, seed), atualizar este doc no **mesmo PR**. Foca em *comportamento*, não em copy/cor/layout.

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

**Cliente final:** e-mail real (OTP chega por email), ex: `thiagodevtavares@gmail.com`.

---

## 1. Home pública do tenant

- [ ] Abrir `/` em anônimo carrega sem erro.
- [ ] Link de login inline funciona (OTP por email).
- [ ] Tab bar do cliente navega: Início / Agendar / Reservas / Perfil.

## 2. Wizard de booking (cliente novo)

- [ ] `/book` lista só serviços com `is_active = true`.
- [ ] Selecionar serviço → `/book/profissional` mostra quem atende aquele serviço + "Qualquer profissional".
- [ ] Selecionar profissional → `/book/data` desativa dias sem business_hours/availability.
- [ ] Selecionar dia → `/book/horario` desativa slots passados, em conflito e dentro de bloqueio.
- [ ] Selecionar slot livre → `/book/login` pede OTP (anônimo).
- [ ] Após OTP → `/book/confirmar` pede nome/telefone.
- [ ] Confirmar → cria `appointments` com snapshot + marca `customers.consent_given_at` → redireciona pra `/book/sucesso`.

## 3. Customer já logado

- [ ] `/meus-agendamentos` lista a reserva criada com status `SCHEDULED`.
- [ ] Cancelar dentro da janela → status vira `CANCELED`.
- [ ] Cancelar fora da janela (ajustar `cancellation_window_hours` pra forçar) → erro.

## 4. Conflito de horário

- [ ] Com reserva existente às 15:00 pro profissional X, `/book/horario` desabilita 15:00 pra X.
- [ ] Tentativa forçada via request direto → `createAppointment` retorna "Horário não disponível".

## 5. Staff — agenda

- [ ] Login em `/salon/login` com staff seeded redireciona pro dashboard.
- [ ] Tab bar do staff navega: Início / Agenda / Equipe / Serviços / Mais.
- [ ] `/salon/dashboard/agenda` lista appointments do dia.
- [ ] `?date=YYYY-MM-DD` navega entre dias.
- [ ] Detalhe do appointment expõe só transições permitidas por `canTransition`.
- [ ] Transição persiste status e atualiza a UI sem reload.
- [ ] Realtime: criar appointment em outra aba → agenda atualiza sozinha em ≤2s.

## 6. Staff — serviços

- [ ] `/salon/dashboard/servicos` cria serviço novo → aparece no wizard.
- [ ] Editar serviço → mudanças persistem e aparecem no wizard.
- [ ] Desativar serviço → some do wizard público.

## 7. Staff — equipe (detail consolidado)

Toda gestão do profissional vive em `/salon/dashboard/profissionais/[id]`.

- [ ] Criar profissional em `/salon/dashboard/profissionais` → aparece na lista.
- [ ] Toggle Ativo/Inativo → inativo some do wizard.
- [ ] Abrir detalhe expõe 4 seções, cada uma persistindo:
  - **Info:** editar nome/apelido/telefone.
  - **Serviços:** toggle chip vincula/desvincula → wizard reflete.
  - **Jornada:** editor semanal; remover segunda → `/book/data` desativa segundas.
  - **Bloqueios:** criar bloqueio (ex.: amanhã 14-17h) → slots no intervalo ficam disabled no wizard. Deletar também funciona.
- [ ] `/salon/dashboard/disponibilidade` e `/equipe-servicos` redirecionam pra `/profissionais`.
- [ ] `/salon/dashboard/configuracoes/horarios`: fechar um dia → wizard bloqueia aquele weekday.

## 7b. Staff — cadastros auxiliares

- [ ] `/salon/dashboard/clientes` lista o cliente criado no passo 2 (read-only).

## 8. LGPD

- [ ] `/perfil` → "Baixar meus dados" baixa JSON com customer + appointments + snapshot do tenant.
- [ ] Apagar conta (digitar "APAGAR"):
  - Cancela reservas futuras.
  - Zera `customer.name/phone/email/user_id/notes` e preenche `deleted_at`.
  - `customer_name_snapshot` dos appointments antigos vira "Cliente removido".
  - Sessão expira.
- [ ] Novo login com mesmo email cria **novo** customer row; o apagado permanece isolado.

## 9. Fora de escopo — stubs

- [ ] Rotas `/salon/dashboard/operacao`, `/financeiro`, `/relatorios`, `/perfil` (salão) retornam placeholder sem quebrar.
- [ ] `/mais` expõe só itens do piloto (Clientes, Horários, Sair).

## 10. Smoke técnico

- [ ] `pnpm typecheck` limpo.
- [ ] `pnpm test` verde.
- [ ] `pnpm lint` zero errors (warnings de `console` em `customer-client.ts` são pré-existentes).
- [ ] `pnpm build` completa sem erro.

## Reset entre runs

```sql
-- via MCP supabase no projeto ara-barber-dev:
delete from appointments where tenant_id in (
  select id from tenants where slug in ('barbearia-teste','bela-imagem')
);
update customers set deleted_at = now(), user_id = null, email = null, phone = null, name = null
  where tenant_id in (select id from tenants where slug in ('barbearia-teste','bela-imagem'));
```

Reset profundo: rodar seed de profissionais/serviços via `supabase/seed` (TODO — Épico 10).

## Known bugs do piloto

Listar aqui assim que descobrir — tudo que não for P0 vira task do Épico 10.
