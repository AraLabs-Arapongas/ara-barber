# Setup manual — notificações

Código e migrations estão prontos e no banco. Falta só configurar secrets externos.

Tempo estimado: 20-30 minutos.

## 1. VAPID keys (web push)

Gera par de chaves localmente:

````bash
npx -y web-push generate-vapid-keys --json



Saída será algo como:

```json
{
  "publicKey": "BNxx...",
  "privateKey": "abc..."
}
````

**Guardar:**

- `VAPID_PRIVATE_KEY` → secret do Supabase (Project Settings → Edge Functions → Secrets)
- `VAPID_PUBLIC_KEY` → secret do Supabase **+** `.env.local` como `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>`
- `VAPID_SUBJECT` → secret do Supabase com valor `mailto:avisos@aralabs.com.br`

## 2. Resend

**Criar conta e validar domínio:**

1. Cria conta em https://resend.com (grátis, 3k emails/mês)
2. Domains → Add Domain → `aralabs.com.br`
3. Resend entrega 3 registros DNS (SPF, DKIM, DMARC). Adiciona no provedor do domínio
4. Clica **Verify** no Resend. Pode levar minutos/horas pra propagar
5. API Keys → Create → nome `ara-barber-pilot`, permission **Sending access**. Copia a key

**Secrets no Supabase:**

- `RESEND_API_KEY` → a API key gerada
- `RESEND_FROM_EMAIL` → `avisos@aralabs.com.br`
- `RESEND_FROM_NAME` → `AraLabs`

## 3. CRON_SECRET + TENANT_ROOT_DOMAIN

**Gerar o cron secret:**

```bash
openssl rand -base64 32
```

No Supabase dashboard (Edge Function Secrets):

- `CRON_SECRET` → valor gerado (**guarda esse valor** — vai precisar literalmente no passo 5 pra injetar no cron SQL)
- `TENANT_ROOT_DOMAIN` → em dev: `lvh.me:3008`. Em produção: `aralabs.com.br`

> ⚠️ **Edge Function Secrets não são visíveis do Postgres.** O `CRON_SECRET` aqui é validado dentro da edge function. O pg_cron roda em Postgres (outro ambiente) e precisa do mesmo valor literalmente na SQL que agenda o job — ver passo 5.
>
> Tentativas de `alter database postgres set app.cron_secret = ...` falham com "permission denied" no Supabase Cloud (role `postgres` não é superuser). Vault é alternativa, mas pro MVP hardcoda no cron SQL mesmo.

## 4. Database Webhook — `on-appointment-event`

Dashboard Supabase → Database → Webhooks → **Create a new hook**:

- **Name:** `on-appointment-event`
- **Table:** `appointments`
- **Events:** marca `Insert` e `Update`
- **Type:** `Supabase Edge Functions`
- **Edge Function:** `on-appointment-event` (já deployada)
- **HTTP Method:** POST
- **HTTP Params/Headers:** deixa default
- **Save**

## 5. Cron schedule pra reminders

Pega o valor do `CRON_SECRET` (visualizando em Edge Function Secrets) e **cola literalmente** no `Bearer ...` abaixo. Roda no SQL Editor:

```sql
-- unschedule qualquer versão antiga
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'send-reminders';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

-- agenda a cada 5min (substituir COLE_O_CRON_SECRET_AQUI pelo valor do secret)
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://sixgkgiirifigoiqbyow.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'Authorization', 'Bearer COLE_O_CRON_SECRET_AQUI'
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
```

Segurança: `cron.job` só é legível por `service_role`, então o secret fica protegido do público. Aceitável pro piloto. Pra rotação frequente, migrar pra Supabase Vault no futuro.

Verifica:

```sql
select jobname, schedule, active from cron.job where jobname = 'send-reminders';
```

Espera `active = true`.

## 6. Rodar smoke

Seguir `docs/smoke-test-pilot.md` seções 7c-7h:

- Agendar, verificar email + push cliente
- Staff verificar push de novo agendamento
- Cancelar e verificar emails + pushes
- Forçar reminder e verificar entrega

Logs úteis:

```sql
-- eventos recentes
select channel, event, status, error_message, created_at
from notification_log
order by created_at desc
limit 20;

-- subscriptions ativas
select user_id, tenant_id, user_agent, last_seen_at
from push_subscriptions
order by created_at desc;
```

Edge function logs: Supabase dashboard → Edge Functions → selecionar a função → Logs.

## Checklist final

- [ ] VAPID: private + public + subject nas secrets; public em `.env.local`
- [ ] Resend: domínio verificado + API key + 3 secrets
- [ ] CRON_SECRET + TENANT_ROOT_DOMAIN como secret
- [ ] Database Webhook criado apontando pra `on-appointment-event`
- [ ] Cron `send-reminders` agendado com o CRON_SECRET hardcoded no Bearer (verificar via `select * from cron.job`)
- [ ] Smoke test passou

Qualquer erro inesperado, inspecionar `notification_log` e edge function logs antes de qualquer outra ação.
