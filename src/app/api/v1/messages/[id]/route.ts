import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Situação de uma mensagem (só o produto que a pediu). GET assinado com corpo vazio. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyRequest("", req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const m = await db.message.findFirst({ where: { id, product: auth.product }, select: { id: true, status: true, providerMessageId: true, error: true, attempts: true, sentAt: true, createdAt: true, to: true, ref: true } });
  if (!m) return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  return NextResponse.json(m);
}
