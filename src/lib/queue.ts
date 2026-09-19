import "server-only";
import { z } from "zod";
import type { MessageStatus } from "@/generated/prisma/enums";
import { db } from "./db";
import { getProvider } from "./providers";
import { isPermanentError, MAX_ATTEMPTS, nextAttempt, normalizePhone } from "./rules";
import { deliverCallback } from "./callbacks";
import type { OutboundMessage, TemplateMessage } from "./provider";

/**
 * Fila de envio. `enqueue` só grava (rápido, dentro da requisição do produto); o worker
 * (`processQueue`, a cada 5 s no processo) entrega com retry e backoff e avisa o produto.
 */
export const enqueueSchema = z.object({
  tenantId: z.string().min(1).max(64),
  tenantName: z.string().max(120).optional(),
  ref: z.string().max(120).optional(),
  callbackUrl: z.string().url().max(300).optional(),
  message: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("free"), to: z.string(), body: z.string().min(1).max(4096), buttons: z.array(z.object({ id: z.string().max(256), title: z.string().max(20) })).max(3).optional() }),
    z.object({
      kind: z.literal("template"), to: z.string(), name: z.string().max(120), language: z.string().max(10), bodyParams: z.array(z.string().max(1024)).max(20), body: z.string().max(4096),
      buttons: z.array(z.union([z.object({ type: z.literal("quick_reply"), payload: z.string().max(256) }), z.object({ type: z.literal("url"), text: z.string().max(256) })])).max(3).optional(),
    }),
  ]),
});
export type EnqueueInput = z.infer<typeof enqueueSchema>;

export async function enqueue(product: string, input: EnqueueInput) {
  const to = normalizePhone(input.message.to);
  if (!to) throw new EnqueueError("telefone inválido (E.164, ex.: +5511999998888)");
  const contact = await db.contact.upsert({ where: { phone: to }, update: { lastProduct: product, lastTenantId: input.tenantId }, create: { phone: to, lastProduct: product, lastTenantId: input.tenantId } });
  const quota = Number(process.env.NOTIFY_MAX_PER_TENANT_MONTH ?? 0);
  let skip: string | null = contact.optedOut ? "telefone pediu para não receber mensagens (opt-out)" : null;
  if (!skip && quota > 0) {
    const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
    const usados = await db.message.count({ where: { product, tenantId: input.tenantId, createdAt: { gte: inicioMes }, status: { notIn: ["SKIPPED", "FAILED"] } } });
    if (usados >= quota) skip = `cota mensal do estabelecimento atingida (${quota})`;
  }
  const { kind, ...payload } = input.message;
  return db.message.create({
    data: {
      product, tenantId: input.tenantId, tenantName: input.tenantName, to, kind, body: input.message.body, payload: { ...payload, to }, ref: input.ref, callbackUrl: input.callbackUrl,
      status: skip ? "SKIPPED" : "QUEUED", error: skip,
    },
    select: { id: true, status: true, error: true },
  });
}

export class EnqueueError extends Error {}

/** Uma rodada do worker: pega o que venceu, envia, agenda retry ou fecha. Idempotente sob concorrência (SENDING = trancado). */
export async function processQueue(limit = 20) {
  const now = new Date();
  const due = await db.message.findMany({ where: { status: "QUEUED", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: limit, select: { id: true } });
  let sent = 0, failed = 0;
  for (const { id } of due) {
    const locked = await db.message.updateMany({ where: { id, status: "QUEUED" }, data: { status: "SENDING" } });
    if (locked.count === 0) continue; // outro worker pegou
    const m = await db.message.findUniqueOrThrow({ where: { id } });
    try {
      const provider = getProvider();
      const r = m.kind === "template" ? await provider.sendTemplate(m.payload as unknown as TemplateMessage) : await provider.send(m.payload as unknown as OutboundMessage);
      await db.message.update({ where: { id }, data: { status: "SENT", providerMessageId: r.providerMessageId ?? `local_${id}`, sentAt: new Date(), attempts: m.attempts + 1, error: null } });
      sent++;
      // O provedor console não manda status por webhook: simula "sent" para o produto fechar o ciclo.
      if (provider.name === "console") await deliverCallback(id, { type: "status", providerMessageId: r.providerMessageId ?? `local_${id}`, status: "sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = m.attempts + 1;
      const proxima = isPermanentError(msg) ? null : nextAttempt(attempts);
      const status: MessageStatus = proxima ? "QUEUED" : "FAILED";
      await db.message.update({ where: { id }, data: { status, attempts, error: msg.slice(0, 500), nextAttemptAt: proxima ?? m.nextAttemptAt } });
      if (status === "FAILED") { failed++; await deliverCallback(id, { type: "status", providerMessageId: m.providerMessageId ?? `local_${id}`, status: "failed", error: msg.slice(0, 200) }); }
      console.error(`[notify] envio ${id} tentativa ${attempts}/${MAX_ATTEMPTS}: ${msg}`);
    }
  }
  return { due: due.length, sent, failed };
}
