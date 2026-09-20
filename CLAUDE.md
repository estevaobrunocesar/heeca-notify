# Heeca Notify — serviço central de notificações

Leia o README.md (contrato e estrutura). Regras:

1. **Credenciais da Meta só aqui.** Nenhum produto recebe token da Meta; produtos usam `WHATSAPP_PROVIDER=notify` e falam com este serviço pelo contrato do README.
2. **Um segredo por produto** (`NOTIFY_SECRET_<PRODUTO>`), verificado em toda rota `/api/v1/*` (`verifyRequest`). Callbacks ao produto são assinados com o mesmo segredo. Nunca aceite chamada sem `X-Heeca-Product`.
3. **A API só grava; o worker envia.** `enqueue` decide SKIPPED (opt-out, cota) na hora; `processQueue` entrega com backoff (`rules.ts`) e tranca com `QUEUED→SENDING`. Erros permanentes da Meta não repetem.
4. **Eventos são transparentes**: o corpo do callback é o mesmo `InboundEvent` que os produtos já tratavam vindo da Meta — payloads de botão (`confirm:<token>`) passam intactos.
5. **Opt-out é global** ("PARAR"): bloqueia o telefone para todos os produtos; produtos podem registrar/consultar em `/api/v1/contacts`.
6. Sem interface: métricas em `/api/v1/stats`; saúde em `/api/health` (`degraded` = fila parada).
7. **Templates unificados** em `templates.ts` (fonte da verdade da plataforma; `docs/TEMPLATES-META.md` e `scripts/meta-templates.mjs` derivam dele). `enqueue` valida nome/parâmetros/botões e prefixa botões de URL com o produto (portal redireciona em `/a/` e `/p/`). Mudar texto de template aprovado = novo nome.
8. Regras puras em `rules.ts`/`auth.ts` com testes (`npm test`, node:test + tsx). Idioma pt-BR.
