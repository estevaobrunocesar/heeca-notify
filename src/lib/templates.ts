/**
 * Catálogo unificado de templates da Meta — FONTE DA VERDADE da plataforma.
 *
 * Um conjunto por EVENTO, neutro de segmento: o vocabulário entra pelas variáveis
 * ("Alongamento em gel", "Sessão de 2 h", "Consulta de avaliação"). Todos os produtos usam
 * os mesmos nomes, na WABA "Heeca". Templates específicos de um produto (orçamento do Ink,
 * pós-procedimento do Piercing…) continuam declarados no produto, com nome `heeca_<produto>_*`,
 * e são cadastrados na mesma WABA.
 *
 * Botões de URL: a Meta exige uma URL base FIXA por template; como cada marca tem um host,
 * a base é o redirecionador do portal (heeca.com.br/a/… e /p/…) e o Notify prefixa o
 * sufixo com o slug do produto: o produto manda "ana-nails", vai "nail/ana-nails".
 *
 * docs/TEMPLATES-META.md e scripts/meta-templates.mjs são gerados/alimentados daqui.
 */

export type TemplateButton = { type: "quick_reply"; text: string } | { type: "url"; text: string; base: string };

export type TemplateSpec = {
  name: string;
  category: "UTILITY";
  language: "pt_BR";
  /** Corpo como cadastrado na Meta ({{1}}, {{2}}…). */
  body: string;
  /** Nome de cada parâmetro, na ordem. */
  params: string[];
  buttons?: TemplateButton[];
  /** Valores de exemplo (a Meta exige para aprovar). */
  example: string[];
  /** Quando é enviado. */
  quando: string;
};

export const PORTAL = "https://heeca.com.br";

export const TEMPLATES: Record<string, TemplateSpec> = {
  heeca_confirmacao: {
    name: "heeca_confirmacao", category: "UTILITY", language: "pt_BR",
    body: "Olá, {{1}}! {{2}} recebeu sua solicitação: {{3}} com {{4}}, {{5}} às {{6}}. Toque em Confirmar para garantir seu horário.",
    params: ["cliente", "estabelecimento", "servico", "profissional", "data", "hora"],
    buttons: [{ type: "quick_reply", text: "Confirmar" }, { type: "quick_reply", text: "Remarcar" }, { type: "quick_reply", text: "Cancelar" }],
    example: ["Maria", "Studio Ana", "Alongamento em gel", "Ana", "20/09/2026", "14:00"],
    quando: "ao criar um agendamento que precisa de confirmação",
  },
  heeca_confirmado: {
    name: "heeca_confirmado", category: "UTILITY", language: "pt_BR",
    body: "Horário confirmado ✅ {{1}}: {{2}} com {{3}}, {{4}} às {{5}}. {{6}}Até lá!",
    params: ["estabelecimento", "servico", "profissional", "data", "hora", "orientacoes"],
    example: ["Studio Ana", "Alongamento em gel", "Ana", "20/09/2026", "14:00", "Chegue alguns minutos antes. "],
    quando: "quando o horário é confirmado (orientações pré-atendimento podem ir vazias: enviar \" \")",
  },
  heeca_lembrete: {
    name: "heeca_lembrete", category: "UTILITY", language: "pt_BR",
    body: "Oi, {{1}}! Lembrete de {{2}}: {{3}}, {{4}} às {{5}}. Se precisar mudar, use os botões abaixo.",
    params: ["cliente", "estabelecimento", "servico", "quando", "hora"],
    buttons: [{ type: "quick_reply", text: "Remarcar" }, { type: "quick_reply", text: "Cancelar" }],
    example: ["Maria", "Studio Ana", "Alongamento em gel", "amanhã", "14:00"],
    quando: "24 h antes do horário",
  },
  heeca_cancelado: {
    name: "heeca_cancelado", category: "UTILITY", language: "pt_BR",
    body: "Aviso de {{1}}: seu horário de {{2}}, {{3}} às {{4}}, foi cancelado. Para marcar de novo, é só tocar no botão.",
    params: ["estabelecimento", "servico", "data", "hora"],
    buttons: [{ type: "url", text: "Agendar novamente", base: `${PORTAL}/a/` }],
    example: ["Studio Ana", "Alongamento em gel", "20/09/2026", "14:00"],
    quando: "cancelamento (pela cliente ou pelo estabelecimento)",
  },
  heeca_remarcado: {
    name: "heeca_remarcado", category: "UTILITY", language: "pt_BR",
    body: "Aviso de {{1}}: seu horário de {{2}} foi remarcado para {{3}} às {{4}}. Qualquer dúvida, responda esta mensagem.",
    params: ["estabelecimento", "servico", "data", "hora"],
    example: ["Studio Ana", "Alongamento em gel", "21/09/2026", "15:00"],
    quando: "reagendamento",
  },
  heeca_sinal: {
    name: "heeca_sinal", category: "UTILITY", language: "pt_BR",
    body: "Olá, {{1}}! Para garantir seu horário de {{2}} em {{3}}, {{4}} às {{5}}, pague o sinal de {{6}} via Pix em até {{7}}. Toque no botão para ver o QR Code.",
    params: ["cliente", "servico", "estabelecimento", "data", "hora", "valor_sinal", "prazo_pagamento"],
    buttons: [{ type: "url", text: "Pagar sinal", base: `${PORTAL}/p/` }],
    example: ["Maria", "Alongamento em gel", "Studio Ana", "20/09/2026", "14:00", "R$ 20,00", "30 minutos"],
    quando: "agendamento que exige sinal via Pix",
  },
  heeca_retorno: {
    name: "heeca_retorno", category: "UTILITY", language: "pt_BR",
    body: "Oi, {{1}}! Aqui é {{2}}. {{3}} Quer reservar seu próximo horário? É só tocar no botão.",
    params: ["cliente", "estabelecimento", "convite"],
    buttons: [{ type: "url", text: "Agendar", base: `${PORTAL}/a/` }],
    example: ["Maria", "Studio Ana", "Está chegando o momento de renovar suas unhas."],
    quando: "retorno inteligente / manutenção (a profissional dispara; automático na fase 2)",
  },
};

/** Renderiza o corpo com os parâmetros (para log e para o provedor console). */
export function renderBody(spec: TemplateSpec, params: string[]) {
  return spec.body.replace(/\{\{(\d+)\}\}/g, (_, i: string) => params[Number(i) - 1] ?? "");
}

/**
 * Valida uma mensagem de template contra o catálogo: nome `heeca_*` sem sufixo de produto precisa
 * existir aqui com o número certo de parâmetros e botões. Nomes de produto (`heeca_ink_*`) passam.
 */
export function validateTemplate(name: string, bodyParams: string[], buttons: { type: string }[] = []): string | null {
  if (!/^heeca_[a-z0-9_]+$/.test(name)) return `nome de template inválido: ${name}`;
  const spec = TEMPLATES[name];
  if (!spec) return /^heeca_(nail|lash|massage|brow|cut|dental|beauty|wellness|ink|piercing|skin|store|ticket|invoice|move|mind|nutri|bronze)_/.test(name) ? null : `template ${name} não está no catálogo unificado`;
  if (bodyParams.length !== spec.params.length) return `${name} espera ${spec.params.length} parâmetro(s) (${spec.params.join(", ")}), recebeu ${bodyParams.length}`;
  const esperados = (spec.buttons ?? []).map((b) => b.type).join(",");
  const recebidos = buttons.map((b) => b.type).join(",");
  if (esperados !== recebidos) return `${name} espera botões [${esperados}], recebeu [${recebidos}]`;
  return null;
}
