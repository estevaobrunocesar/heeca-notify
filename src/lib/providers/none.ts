import type { ProviderHealth, SendResult, WhatsappProvider } from "../provider";

/**
 * Canal compartilhado DESLIGADO (WHATSAPP_PROVIDER=none). O número que a plataforma usava para todos os produtos passou a ser
 * exclusivo do Heeca Assist (05/10/2026): os demais só enviam pelo número do próprio estabelecimento (TenantChannel, Meta/Embedded
 * Signup), que o worker resolve ANTES de chamar este provedor. Se algo chegar aqui, não há remetente: falha clara e permanente
 * ("não configurad…" casa com isPermanentError) — nunca simulação, que fingiria entrega ao produto.
 */
export const SHARED_OFF_ERROR = "WhatsApp não configurado: o estabelecimento ainda não conectou o próprio número";

export class DisabledProvider implements WhatsappProvider {
  readonly name = "none";
  async send(): Promise<SendResult> { throw new Error(SHARED_OFF_ERROR); }
  async sendTemplate(): Promise<SendResult> { throw new Error(SHARED_OFF_ERROR); }
  async healthCheck(): Promise<ProviderHealth> { return { ok: false, error: "canal compartilhado desativado (só envio pelo número do estabelecimento)" }; }
}
