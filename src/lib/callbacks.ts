import "server-only";
import { db } from "./db";
import { secretFor, signedHeaders } from "./auth";
import type { InboundEvent } from "./provider";

/**
 * Devolve um evento ao produto dono da mensagem (POST assinado no `callbackUrl` que ele informou).
 * O corpo é exatamente um InboundEvent — o produto reaproveita o `handleEvent` que já tinha para a Meta.
 * Falha de callback não derruba nada aqui: fica registrada em InboundEvent.delivered=false para reenvio.
 */
export async function deliverCallback(messageId: string, event: InboundEvent, extra: { phone?: string; payload?: unknown } = {}) {
  const m = await db.message.findUnique({ where: { id: messageId }, select: { product: true, callbackUrl: true, tenantId: true, ref: true } });
  const registro = await db.inboundEvent.create({ data: { type: event.type, phone: extra.phone ?? ("from" in event ? event.from : null), providerMessageId: event.providerMessageId, payload: (extra.payload ?? event) as object, messageId, product: m?.product } });
  if (!m?.callbackUrl) return;
  // O evento vai com tenantId/ref da mensagem de origem: produtos sem número por estabelecimento roteiam por eles.
  const ok = await postToProduct(m.product, m.callbackUrl, { ...event, tenantId: m.tenantId, ref: m.ref ?? undefined } as InboundEvent);
  await db.inboundEvent.update({ where: { id: registro.id }, data: { delivered: ok.ok, error: ok.error } });
}

export async function postToProduct(product: string, url: string, event: InboundEvent): Promise<{ ok: boolean; error?: string }> {
  const secret = secretFor(product);
  if (!secret) return { ok: false, error: `sem segredo para ${product}` };
  const raw = JSON.stringify(event);
  try {
    const res = await fetch(url, { method: "POST", headers: signedHeaders(product, secret, raw), body: raw, signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Reenvia callbacks que falharam nas últimas 24 h (chamado pelo worker a cada rodada, poucos por vez). */
export async function retryCallbacks(limit = 10) {
  const pend = await db.inboundEvent.findMany({ where: { delivered: false, messageId: { not: null }, createdAt: { gte: new Date(Date.now() - 86_400_000) }, error: { not: null } }, orderBy: { createdAt: "asc" }, take: limit });
  for (const ev of pend) {
    const m = await db.message.findUnique({ where: { id: ev.messageId! }, select: { product: true, callbackUrl: true, tenantId: true, ref: true } });
    if (!m?.callbackUrl) continue;
    const r = await postToProduct(m.product, m.callbackUrl, { ...(ev.payload as object), tenantId: m.tenantId, ref: m.ref ?? undefined } as InboundEvent);
    await db.inboundEvent.update({ where: { id: ev.id }, data: { delivered: r.ok, error: r.ok ? null : r.error } });
  }
}
