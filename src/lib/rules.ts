/** Regras puras da fila e do consentimento (testadas sem banco). */

/** Backoff das tentativas de envio: 1 min, 5 min, 30 min, 2 h, 6 h; depois desiste (FAILED). */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length;

export function nextAttempt(attempts: number, now = Date.now()): Date | null {
  return attempts >= MAX_ATTEMPTS ? null : new Date(now + BACKOFF_MS[attempts]);
}

/** Erros da Meta que não adianta repetir (número inválido, sem WhatsApp, template rejeitado, opt-out). */
export function isPermanentError(message: string): boolean {
  return /\((131026|131047|131051|132000|132001|132012|133010|100)[\/)]|não tem WhatsApp|invalid|não configurad/i.test(message);
}

/** Palavras que registram opt-out (LGPD/regra da Meta): o telefone deixa de receber de TODOS os produtos. */
export function isOptOut(text: string): boolean {
  return /^\s*(parar|pare|sair|cancelar\s+mensagens|stop|descadastrar|remover)\s*[.!]?\s*$/i.test(text);
}

/** E.164 estrito: +55 e 10–13 dígitos. */
export function normalizePhone(v: string): string | null {
  const s = v.replace(/[^\d+]/g, "");
  return /^\+\d{10,15}$/.test(s) ? s : null;
}

/**
 * Com o canal compartilhado desligado (WHATSAPP_PROVIDER=none), só sai mensagem de estabelecimento com número próprio ativo e
 * conectado. Devolve o motivo para o SKIPPED imediato (o produto vê na resposta do enqueue), ou null se pode enfileirar.
 */
export function sharedChannelBlock(
  providerName: string,
  channel: { active: boolean; provider: string; connectionStatus?: string | null } | null,
): string | null {
  if (providerName.trim().toLowerCase() !== "none") return null;
  if (channel?.active && channel.provider === "meta" && channel.connectionStatus === "CONNECTED") return null;
  return "WhatsApp não configurado: o estabelecimento ainda não conectou o próprio número";
}
