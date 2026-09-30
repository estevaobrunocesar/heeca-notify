import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/rules";

export const dynamic = "force-dynamic";

/**
 * Canal próprio de WhatsApp por tenant (D11 — número/WABA do cliente final via Embedded Signup, em
 * vez do compartilhado da plataforma). O produto chama isto quando o onboarding do cliente completa
 * (ele conectou o WhatsApp Business dele e os templates foram aprovados na WABA dele).
 */
const schema = z.object({
  tenantId: z.string().min(1).max(64),
  fromPhone: z.string(),
  contentSids: z.record(z.string(), z.string()).default({}),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  const raw = await req.text();
  const auth = verifyRequest(raw, req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "corpo inválido", issues: parsed.error.issues }, { status: 400 });
  const fromPhone = normalizePhone(parsed.data.fromPhone);
  if (!fromPhone) return NextResponse.json({ error: "fromPhone inválido (E.164)" }, { status: 422 });
  const tc = await db.tenantChannel.upsert({
    where: { product_tenantId: { product: auth.product, tenantId: parsed.data.tenantId } },
    update: { fromPhone, contentSids: parsed.data.contentSids, active: parsed.data.active },
    create: { product: auth.product, tenantId: parsed.data.tenantId, fromPhone, contentSids: parsed.data.contentSids, active: parsed.data.active },
  });
  return NextResponse.json({ tenantId: tc.tenantId, fromPhone: tc.fromPhone, active: tc.active, templates: Object.keys(tc.contentSids as Record<string, string>) });
}

/** GET ?tenantId= — o produto confere se o tenant já tem canal próprio antes de oferecer a opção de novo. */
export async function GET(req: Request) {
  const auth = verifyRequest("", req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? "";
  if (!tenantId) return NextResponse.json({ error: "tenantId obrigatório" }, { status: 422 });
  const tc = await db.tenantChannel.findUnique({ where: { product_tenantId: { product: auth.product, tenantId } } });
  if (!tc) return NextResponse.json({ configured: false });
  return NextResponse.json({ configured: true, fromPhone: tc.fromPhone, active: tc.active, templates: Object.keys(tc.contentSids as Record<string, string>) });
}

/** DELETE ?tenantId= — desconectar o canal próprio; a partir daqui volta a usar o número compartilhado. */
export async function DELETE(req: Request) {
  const auth = verifyRequest("", req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? "";
  if (!tenantId) return NextResponse.json({ error: "tenantId obrigatório" }, { status: 422 });
  await db.tenantChannel.deleteMany({ where: { product: auth.product, tenantId } });
  return NextResponse.json({ ok: true });
}
