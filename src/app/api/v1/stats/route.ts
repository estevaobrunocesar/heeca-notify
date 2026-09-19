import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Contagem do mês por status e por estabelecimento, do produto que pergunta (o portal-admin agrega). */
export async function GET(req: Request) {
  const auth = verifyRequest("", req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  const porStatus = await db.message.groupBy({ by: ["status"], where: { product: auth.product, createdAt: { gte: inicioMes } }, _count: true });
  const porTenant = await db.message.groupBy({ by: ["tenantId"], where: { product: auth.product, createdAt: { gte: inicioMes }, status: { notIn: ["SKIPPED", "FAILED"] } }, _count: true, orderBy: { _count: { tenantId: "desc" } }, take: 50 });
  return NextResponse.json({
    product: auth.product,
    since: inicioMes,
    byStatus: Object.fromEntries(porStatus.map((s) => [s.status, s._count])),
    byTenant: porTenant.map((t) => ({ tenantId: t.tenantId, count: t._count })),
  });
}
