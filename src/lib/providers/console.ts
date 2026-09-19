import type { OutboundMessage, ProviderHealth, SendResult, TemplateMessage, WhatsappProvider } from "../provider";

/** Provedor de desenvolvimento/homologação: imprime no log e devolve um id sintético. */
export class ConsoleProvider implements WhatsappProvider {
  readonly name = "console";
  private print(to: string, body: string, footer?: string): SendResult {
    console.log(`\n┌─ WhatsApp → ${to}\n` + body.split("\n").map((l) => `│ ${l}`).join("\n") + (footer ? `\n│\n│ ${footer}` : "") + `\n└─────────────────────────────\n`);
    return { providerMessageId: `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  }
  async send(m: OutboundMessage) { return this.print(m.to, m.body, m.buttons?.map((b) => `[${b.title}] (id=${b.id})`).join("  ")); }
  async sendTemplate(m: TemplateMessage) { return this.print(m.to, `(template ${m.name}/${m.language})\n${m.body}`, m.buttons?.map((b) => (b.type === "quick_reply" ? `[quick_reply ${b.payload}]` : `[url ${b.text}]`)).join("  ")); }
  async healthCheck(): Promise<ProviderHealth> { return { ok: true, verifiedName: "console (homologação)" }; }
}
