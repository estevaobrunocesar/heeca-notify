/**
 * Abstração do provedor de WhatsApp — o mesmo contrato dos produtos (heeca_nail/src/lib/whatsapp/provider.ts),
 * para o Notify ser transparente: o produto monta a mensagem, o Notify só entrega e devolve eventos.
 */
export type QuickReplyButton = { id: string; title: string };
/**
 * Canal próprio do tenant (D11 — WABA por cliente final via Embedded Signup), resolvido pelo worker
 * a partir de `TenantChannel` antes de chamar o provedor. Ausente = cai no número/ContentSid
 * compartilhado da plataforma (comportamento de hoje, sem mudança). `contentSids` é obrigatório se o
 * envio for `kind: "template"`: cada WABA tem ContentSids próprios mesmo pro mesmo texto de template.
 */
export type ChannelOverride = { from: string; contentSids?: Record<string, string> };
export type OutboundMessage = { to: string; body: string; buttons?: QuickReplyButton[]; channel?: ChannelOverride };
export type TemplateMessage = {
  to: string; name: string; language: string; bodyParams: string[];
  buttons?: ({ type: "quick_reply"; payload: string } | { type: "url"; text: string })[];
  body: string;
  channel?: ChannelOverride;
};
export type SendResult = { providerMessageId?: string };
export type ProviderHealth =
  | { ok: true; phoneNumber?: string; verifiedName?: string; qualityRating?: string }
  | { ok: false; error: string };

export interface WhatsappProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
  sendTemplate(message: TemplateMessage): Promise<SendResult>;
  healthCheck(): Promise<ProviderHealth>;
}

/**
 * Evento normalizado (mesmo formato que os produtos já tratam em handleEvent). No callback ao produto vai
 * acrescido de `tenantId`/`ref` da mensagem de origem (roteamento em produtos sem número por estabelecimento).
 */
export type InboundEvent = ({ tenantId?: string; ref?: string; phoneNumberId?: string }) & (
  | { type: "button_reply"; from: string; buttonId: string; providerMessageId: string; contextMessageId?: string }
  | { type: "text"; from: string; text: string; providerMessageId: string; contextMessageId?: string }
  | { type: "status"; providerMessageId: string; status: "sent" | "delivered" | "read" | "failed"; error?: string });
