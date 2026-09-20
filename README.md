# Heeca Notify

Serviço central de notificações (WhatsApp) da plataforma Heeca. **Nenhum produto fala com a Meta**: o produto manda "esta mensagem para este telefone" e o Notify entrega, tenta de novo, registra consentimento e devolve status/respostas por callback assinado.

- Uma WABA "Heeca", um número (depois um por família); credenciais da Meta só aqui.
- Um segredo HMAC por produto (`NOTIFY_SECRET_<PRODUTO>`): comprometer um produto não permite falar em nome de outro.
- Opt-out global por telefone ("PARAR"); cota mensal por estabelecimento (`NOTIFY_MAX_PER_TENANT_MONTH`).
- Sem interface: operação pelo `/api/health` (monitor) e `/api/v1/stats` (portal-admin).

## Contrato (produto → Notify)

Cabeçalhos: `X-Heeca-Product: nail`, `X-Heeca-Timestamp: <ms>`, `X-Heeca-Signature: hex(HMAC-SHA256(secret, "<ts>.<corpo>"))` (janela 5 min).

| Método | Rota | Corpo / resposta |
|---|---|---|
| POST | `/api/v1/messages` | `{ tenantId, tenantName?, ref?, callbackUrl?, message: { kind: "free", to, body, buttons? } \| { kind: "template", to, name, language, bodyParams, body, buttons? } }` → `202 { id, status: QUEUED\|SKIPPED, reason? }` |
| GET | `/api/v1/messages/:id` | situação (assinar corpo vazio) |
| POST/GET | `/api/v1/contacts` | `{ phone, optedOut }` / `?phone=` |
| GET | `/api/v1/stats` | contagem do mês por status e por estabelecimento |
| GET/POST | `/api/webhooks/meta` | webhook da Meta (verify token + `X-Hub-Signature-256`) |

**Notify → produto** (`callbackUrl`, assinado com o mesmo segredo, `X-Heeca-Product` = produto): o corpo é um `InboundEvent` — `{ type: "status", providerMessageId, status, error? }`, `{ type: "button_reply", from, buttonId, providerMessageId }` ou `{ type: "text", from, text, providerMessageId }` — sempre com `tenantId` e `ref` da mensagem de origem. `providerMessageId` de status = o `id` que o Notify devolveu no envio. O produto responde 2xx; erro = o Notify reenvia por 24 h.

Roteamento de respostas: pela mensagem a que o cliente respondeu (`context.id` da Meta) ou, sem contexto, pela última mensagem enviada àquele telefone.

## Rodando

```bash
docker run -d --name heeca_notify_db -e POSTGRES_USER=heeca -e POSTGRES_PASSWORD=heeca -e POSTGRES_DB=heeca_notify -p 5908:5432 postgres:17-alpine
cp .env.example .env   # NOTIFY_SECRET_NAIL=<32+ chars>
npm install && npx prisma migrate deploy && npm run dev   # porta 4130
npm test
```

Produção: `Dockerfile` (standalone + `prisma migrate deploy` no boot), app `heeca-notify` + `heeca-notify-db` no Coolify (`infra/coolify-setup.mjs`), `notify.heeca.com.br`. O worker roda dentro do processo (`NOTIFY_WORKER_INPROCESS=true`); com réplicas, o lock `QUEUED→SENDING` evita envio duplo.

## Estrutura

`src/lib/auth.ts` (HMAC por produto) · `rules.ts` (backoff, opt-out, E.164 — puros, testados) · `queue.ts` (enfileirar, worker) · `callbacks.ts` (devolver ao produto, reenvio) · `inbound.ts` (roteamento) · `providers/{console,meta}.ts` · `worker.ts` (boot).
