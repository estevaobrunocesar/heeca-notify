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
