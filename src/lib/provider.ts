/**
 * Abstração do provedor de WhatsApp — o mesmo contrato dos produtos (heeca_nail/src/lib/whatsapp/provider.ts),
 * para o Notify ser transparente: o produto monta a mensagem, o Notify só entrega e devolve eventos.
 */
export type QuickReplyButton = { id: string; title: string };
export type OutboundMessage = { to: string; body: string; buttons?: QuickReplyButton[] };
export type TemplateMessage = {
  to: string; name: string; language: string; bodyParams: string[];
  buttons?: ({ type: "quick_reply"; payload: string } | { type: "url"; text: string })[];
  body: string;
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

/** Evento normalizado (mesmo formato que os produtos já tratam em handleEvent). */
export type InboundEvent =
  | { type: "button_reply"; from: string; buttonId: string; providerMessageId: string; contextMessageId?: string }
  | { type: "text"; from: string; text: string; providerMessageId: string; contextMessageId?: string }
  | { type: "status"; providerMessageId: string; status: "sent" | "delivered" | "read" | "failed"; error?: string };
