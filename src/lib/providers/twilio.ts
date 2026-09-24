import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundEvent, OutboundMessage, ProviderHealth, SendResult, TemplateMessage, WhatsappProvider } from "../provider";

const API = "https://api.twilio.com/2010-04-01";

/**
 * WhatsApp via Twilio (BSP — Business Solution Provider). Alternativa ao Meta Cloud API direto
 * (providers/meta.ts): a verificação de negócio é feita pela Twilio, não pelo cadastro no Meta for
 * Developers, que travou a conta pessoal do Bruno duas vezes (23-24/09/2026). Mesmo WhatsApp Business
 * Platform por trás — templates ainda passam por aprovação de conteúdo da Meta.
 *
 * Diferenças reais do Meta direto que este provider não pode disfarçar:
 *  - Botões (quick_reply / url) só existem dentro de um Content Template pré-cadastrado no Twilio
 *    Console — não dá para mandar botões ad-hoc numa mensagem livre como o Meta Cloud API permite.
 *    `send()` com `buttons` aqui deixa de enviá-los como interativo e os lista como texto numerado.
 *  - `sendTemplate` não usa o nome do template (heeca_confirmacao etc.) direto: a Twilio identifica
 *    templates por um ContentSid próprio (HXxxxxxxxx…). O mapeamento nome → ContentSid vem de
 *    `TWILIO_CONTENT_SID_<NOME_EM_MAIUSCULO>` (mesmo padrão de segredo-por-chave de NOTIFY_SECRET_<PRODUTO>).
 *    Falta o mapeamento de um template = erro claro, não silêncio.
 *
 * Variáveis: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (E.164, sem "whatsapp:").
 */
export class TwilioProvider implements WhatsappProvider {
  readonly name = "twilio";
  constructor(
    private readonly accountSid = process.env.TWILIO_ACCOUNT_SID ?? "",
    private readonly authToken = process.env.TWILIO_AUTH_TOKEN ?? "",
    private readonly from = process.env.TWILIO_WHATSAPP_FROM ?? "",
  ) {
    if (!this.accountSid || !this.authToken || !this.from) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM não configurados");
  }

  private auth() {
    return "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
  }

  private async post<T>(path: string, form: Record<string, string>): Promise<T> {
    const body = new URLSearchParams(form);
    const res = await fetch(`${API}/${path}`, { method: "POST", headers: { Authorization: this.auth(), "Content-Type": "application/x-www-form-urlencoded" }, body });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
    if (!res.ok) throw new Error(`Twilio API (${json.code ?? res.status}): ${json.message ?? res.statusText}`);
    return json;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API}/${path}`, { headers: { Authorization: this.auth(), Accept: "application/json" } });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
    if (!res.ok) throw new Error(`Twilio API (${json.code ?? res.status}): ${json.message ?? res.statusText}`);
    return json;
  }

  /** Mensagem livre — só dentro da janela de 24 h da conversa, mesma regra do Meta. */
  async send(message: OutboundMessage): Promise<SendResult> {
    const to = message.to.replace(/\D/g, "");
    // Sem Content API, botão ad-hoc não existe na Twilio — degrada para lista numerada em texto.
    const body = message.buttons?.length ? `${message.body}\n\n${message.buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n")}` : message.body;
    const json = await this.post<{ sid: string }>("Messages.json", { From: `whatsapp:${this.from}`, To: `whatsapp:+${to}`, Body: body });
    return { providerMessageId: json.sid };
  }

  /**
   * Template aprovado, fora da janela de 24 h. `message.name` é o nome interno da plataforma
   * (heeca_confirmacao, heeca_nutri_plano_disponivel…); a Twilio precisa do ContentSid equivalente.
   */
  async sendTemplate(message: TemplateMessage): Promise<SendResult> {
    const key = `TWILIO_CONTENT_SID_${message.name.toUpperCase()}`;
    const contentSid = process.env[key];
    if (!contentSid) throw new Error(`${key} não configurado — cadastre o template "${message.name}" como Content Template na Twilio e aponte o ContentSid aqui.`);
    const variables: Record<string, string> = {};
    message.bodyParams.forEach((v, i) => { variables[String(i + 1)] = v.replace(/\s*\n\s*/g, " "); });
    const to = message.to.replace(/\D/g, "");
    const json = await this.post<{ sid: string }>("Messages.json", {
      From: `whatsapp:${this.from}`,
      To: `whatsapp:+${to}`,
      ContentSid: contentSid,
      ...(message.bodyParams.length ? { ContentVariables: JSON.stringify(variables) } : {}),
    });
    return { providerMessageId: json.sid };
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const acc = await this.get<{ status?: string; friendly_name?: string }>(`Accounts/${this.accountSid}.json`);
      if (acc.status && acc.status !== "active") return { ok: false, error: `conta Twilio com status "${acc.status}"` };
      return { ok: true, phoneNumber: this.from, verifiedName: acc.friendly_name };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Assinatura do webhook da Twilio: HMAC-SHA1 em base64 sobre a URL completa + os pares
   * chave=valor do form ordenados e concatenados (sem separador) — desenho da própria Twilio,
   * diferente do HMAC-SHA256 do corpo cru que a Meta usa. https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  static validSignature(authToken: string, url: string, params: Record<string, string>, header: string | null): boolean {
    if (!authToken) return false;
    if (!header) return false;
    const base = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
    const expected = createHmac("sha1", authToken).update(base, "utf8").digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Form-urlencoded da Twilio → eventos normalizados. Duas rotas diferentes na Twilio (mensagem
   * recebida vs. status de entrega) caem aqui como o mesmo shape de `URLSearchParams`, distinguidas
   * pela presença de `MessageStatus` (callback de status) vs `Body`/`ButtonPayload` (mensagem recebida).
   */
  static parseWebhook(form: URLSearchParams): InboundEvent[] {
    const sid = form.get("MessageSid") ?? form.get("SmsSid");
    if (!sid) return [];
    const status = form.get("MessageStatus");
    if (status) {
      const map: Record<string, "sent" | "delivered" | "read" | "failed"> = { sent: "sent", delivered: "delivered", read: "read", failed: "failed", undelivered: "failed" };
      const normalized = map[status];
      if (!normalized) return [];
      const errorCode = form.get("ErrorCode");
      return [{ type: "status", providerMessageId: sid, status: normalized, error: errorCode ? `Twilio error ${errorCode}` : undefined }];
    }
    const from = (form.get("From") ?? "").replace(/^whatsapp:/, "");
    const buttonPayload = form.get("ButtonPayload"); // resposta a um Content Template com quick_reply
    if (buttonPayload) return [{ type: "button_reply", from, buttonId: buttonPayload, providerMessageId: sid }];
    const body = form.get("Body");
    if (body) return [{ type: "text", from, text: body, providerMessageId: sid }];
    return [];
  }
}
