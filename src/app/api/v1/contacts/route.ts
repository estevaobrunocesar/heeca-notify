import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/rules";

export const dynamic = "force-dynamic";

const schema = z.object({ phone: z.string(), optedOut: z.boolean() });

/** Consentimento por telefone: o produto registra opt-out/opt-in vindos do seu próprio fluxo (ex.: cliente pediu no balcão). */
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
  if (!parsed.success) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "telefone inválido" }, { status: 422 });
  const optOutAt = parsed.data.optedOut ? new Date() : null;
  const c = await db.contact.upsert({
    where: { phone },
    update: { optedOut: parsed.data.optedOut, optOutAt, lastProduct: auth.product },
    create: { phone, optedOut: parsed.data.optedOut, optOutAt, lastProduct: auth.product },
  });
  return NextResponse.json({ phone: c.phone, optedOut: c.optedOut });
}

/** GET ?phone= — o produto pode consultar antes de prometer um lembrete. */
export async function GET(req: Request) {
  const auth = verifyRequest("", req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const phone = normalizePhone(new URL(req.url).searchParams.get("phone") ?? "");
  if (!phone) return NextResponse.json({ error: "telefone inválido" }, { status: 422 });
  const c = await db.contact.findUnique({ where: { phone } });
  return NextResponse.json({ phone, optedOut: c?.optedOut ?? false });
}
