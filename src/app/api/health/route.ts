import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + readiness: banco, tamanho da fila e falhas nas últimas 24 h (o monitor lê `status: degraded`). */
export async function GET() {
  try {
    const agora = Date.now();
    const [queued, failed24h, stuck] = await Promise.all([
      db.message.count({ where: { status: "QUEUED" } }),
      db.message.count({ where: { status: "FAILED", updatedAt: { gte: new Date(agora - 86_400_000) } } }),
      // vencidas há mais de 15 min sem ninguém pegar = worker parado
      db.message.count({ where: { status: "QUEUED", nextAttemptAt: { lt: new Date(agora - 15 * 60_000) } } }),
    ]);
    return Response.json({ ok: true, status: stuck > 0 ? "degraded" : "ok", db: "up", provider: process.env.WHATSAPP_PROVIDER ?? "console", queued, failed24h, stuck });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
