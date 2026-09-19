import "server-only";
import { db } from "./db";
import { deliverCallback } from "./callbacks";
import { isOptOut } from "./rules";
import type { InboundEvent } from "./provider";

/**
 * Roteia um evento da Meta para o produto certo:
 *  - status: pela mensagem com aquele providerMessageId;
 *  - resposta (botão/texto): pela mensagem a que o cliente respondeu (context.id) ou, sem contexto,
 *    pela última mensagem enviada àquele telefone (é dela que ele está falando);
 *  - "PARAR" registra opt-out global antes de qualquer roteamento.
 */
export async function routeEvent(ev: InboundEvent) {
  if (ev.type === "status") {
    const m = await db.message.findUnique({ where: { providerMessageId: ev.providerMessageId }, select: { id: true } });
    if (!m) return { routed: false };
    const map = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as const;
    await db.message.update({ where: { id: m.id }, data: { status: map[ev.status], ...(ev.error ? { error: ev.error } : {}) } });
    await deliverCallback(m.id, ev);
    return { routed: true };
  }

  if (ev.type === "text" && isOptOut(ev.text)) {
    await db.contact.upsert({ where: { phone: ev.from }, update: { optedOut: true, optOutAt: new Date() }, create: { phone: ev.from, optedOut: true, optOutAt: new Date() } });
  }
  const alvo = ev.contextMessageId
    ? await db.message.findUnique({ where: { providerMessageId: ev.contextMessageId }, select: { id: true } })
    : await db.message.findFirst({ where: { to: ev.from, status: { in: ["SENT", "DELIVERED", "READ"] } }, orderBy: { sentAt: "desc" }, select: { id: true } });
  if (!alvo) {
    await db.inboundEvent.create({ data: { type: ev.type, phone: ev.from, providerMessageId: ev.providerMessageId, payload: ev as object, error: "sem mensagem de origem para rotear" } });
    return { routed: false };
  }
  await deliverCallback(alvo.id, ev, { phone: ev.from });
  return { routed: true };
}
