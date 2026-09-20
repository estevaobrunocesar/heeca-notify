# Templates unificados da Heeca (WhatsApp Business / Meta)

Um conjunto por **evento**, neutro de segmento — todos os produtos usam os mesmos nomes na WABA "Heeca" (gerado de `src/lib/templates.ts`; não edite à mão: `npx tsx scripts/templates-doc.mjs`).

Cadastro: Meta Business Suite → WhatsApp Manager → Modelos de mensagem → Criar modelo. Ou automático quando a WABA existir: `node scripts/meta-templates.mjs` (usa `WHATSAPP_BUSINESS_ACCOUNT_ID` e `WHATSAPP_ACCESS_TOKEN`).

Regras que a Meta aplica na aprovação: categoria **Utilidade** (transacional; nada promocional), variáveis não podem começar nem terminar o corpo com espaço, botões de URL com base fixa (`https://heeca.com.br/a/` agenda; `https://heeca.com.br/p/` pagamento — o portal redireciona para o host do produto), até 3 botões, textos de botão ≤ 25 caracteres.

Templates específicos de um produto (ex.: orçamento do Ink, pós-procedimento do Piercing) ficam declarados no produto com nome `heeca_<produto>_*` e são cadastrados na mesma WABA.

### heeca_confirmacao

*Quando:* ao criar um agendamento que precisa de confirmação.

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_confirmacao`
- **Corpo** (cole exatamente):

```
Olá, {{1}}! {{2}} recebeu sua solicitação: {{3}} com {{4}}, {{5}} às {{6}}. Toque em Confirmar para garantir seu horário.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `estabelecimento` | Studio Ana |
| {{3}} | `servico` | Alongamento em gel |
| {{4}} | `profissional` | Ana |
| {{5}} | `data` | 20/09/2026 |
| {{6}} | `hora` | 14:00 |

**Botões** (nesta ordem):
1. **Resposta rápida** — texto: `Confirmar`
2. **Resposta rápida** — texto: `Remarcar`
3. **Resposta rápida** — texto: `Cancelar`

### heeca_confirmado

*Quando:* quando o horário é confirmado (orientações pré-atendimento podem ir vazias: enviar " ").

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_confirmado`
- **Corpo** (cole exatamente):

```
Horário confirmado ✅ {{1}}: {{2}} com {{3}}, {{4}} às {{5}}. {{6}}Até lá!
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `estabelecimento` | Studio Ana |
| {{2}} | `servico` | Alongamento em gel |
| {{3}} | `profissional` | Ana |
| {{4}} | `data` | 20/09/2026 |
| {{5}} | `hora` | 14:00 |
| {{6}} | `orientacoes` | Chegue alguns minutos antes.  |

### heeca_lembrete

*Quando:* 24 h antes do horário.

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_lembrete`
- **Corpo** (cole exatamente):

```
Oi, {{1}}! Lembrete de {{2}}: {{3}}, {{4}} às {{5}}. Se precisar mudar, use os botões abaixo.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `estabelecimento` | Studio Ana |
| {{3}} | `servico` | Alongamento em gel |
| {{4}} | `quando` | amanhã |
| {{5}} | `hora` | 14:00 |

**Botões** (nesta ordem):
1. **Resposta rápida** — texto: `Remarcar`
2. **Resposta rápida** — texto: `Cancelar`

### heeca_cancelado

*Quando:* cancelamento (pela cliente ou pelo estabelecimento).

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_cancelado`
- **Corpo** (cole exatamente):

```
Aviso de {{1}}: seu horário de {{2}}, {{3}} às {{4}}, foi cancelado. Para marcar de novo, é só tocar no botão.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `estabelecimento` | Studio Ana |
| {{2}} | `servico` | Alongamento em gel |
| {{3}} | `data` | 20/09/2026 |
| {{4}} | `hora` | 14:00 |

**Botões** (nesta ordem):
1. **Acessar site** — texto: `Agendar novamente`, tipo de URL: **Dinâmica**, URL: `https://heeca.com.br/a/{{1}}` (exemplo: `https://heeca.com.br/a/nail/studio-ana`)

### heeca_remarcado

*Quando:* reagendamento.

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_remarcado`
- **Corpo** (cole exatamente):

```
Aviso de {{1}}: seu horário de {{2}} foi remarcado para {{3}} às {{4}}. Qualquer dúvida, responda esta mensagem.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `estabelecimento` | Studio Ana |
| {{2}} | `servico` | Alongamento em gel |
| {{3}} | `data` | 21/09/2026 |
| {{4}} | `hora` | 15:00 |

### heeca_sinal

*Quando:* agendamento que exige sinal via Pix.

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_sinal`
- **Corpo** (cole exatamente):

```
Olá, {{1}}! Para garantir seu horário de {{2}} em {{3}}, {{4}} às {{5}}, pague o sinal de {{6}} via Pix em até {{7}}. Toque no botão para ver o QR Code.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `servico` | Alongamento em gel |
| {{3}} | `estabelecimento` | Studio Ana |
| {{4}} | `data` | 20/09/2026 |
| {{5}} | `hora` | 14:00 |
| {{6}} | `valor_sinal` | R$ 20,00 |
| {{7}} | `prazo_pagamento` | 30 minutos |

**Botões** (nesta ordem):
1. **Acessar site** — texto: `Pagar sinal`, tipo de URL: **Dinâmica**, URL: `https://heeca.com.br/p/{{1}}` (exemplo: `https://heeca.com.br/p/nail/studio-ana`)

### heeca_retorno

*Quando:* retorno inteligente / manutenção (a profissional dispara; automático na fase 2).

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** `heeca_retorno`
- **Corpo** (cole exatamente):

```
Oi, {{1}}! Aqui é {{2}}. {{3}} Quer reservar seu próximo horário? É só tocar no botão.
```

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
| {{1}} | `cliente` | Maria |
| {{2}} | `estabelecimento` | Studio Ana |
| {{3}} | `convite` | Está chegando o momento de renovar suas unhas. |

**Botões** (nesta ordem):
1. **Acessar site** — texto: `Agendar`, tipo de URL: **Dinâmica**, URL: `https://heeca.com.br/a/{{1}}` (exemplo: `https://heeca.com.br/a/nail/studio-ana`)

