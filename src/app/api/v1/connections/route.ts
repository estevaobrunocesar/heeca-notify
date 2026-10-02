import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { exchangeCode, getPhone, listTemplates, registerPhone, subscribeApp, syncTemplates, templatesFor } from "@/lib/meta-onboarding";
import { normalizePhone } from "@/lib/rules";

export const dynamic = "force-dynamic";

/**
 * Conexão do WhatsApp do cliente (Embedded Signup, D11). SÓ o portal chama (produto `portal`): é ele que
 * hospeda o botão e sabe quais produtos/estabelecimentos a conta contratou. O token do negócio nasce e fica aqui.
 *
 * POST  { accountRef, code, wabaId, phoneNumberId, targets:[{product,tenantId}] } — primeira conexão
 * POST  { accountRef, targets }                                                     — só atualiza a quais estabelecimentos o número atende
 * GET   ?accountRef=                                                                — estado + status dos templates na WABA do cliente
 * DELETE ?accountRef=                                                               — desconecta (volta ao número compartilhado)
 */
const schema = z.object({
  accountRef: z.string().min(1).max(64),
  code: z.string().min(10).max(2048).optional(),
  wabaId: z.string().regex(/^\d{5,30}$/).optional(),
  phoneNumberId: z.string().regex(/^\d{5,30}$/).optional(),
  targets: z.array(z.object({ product: z.string().regex(/^[a-z0-9-]{2,32}$/), tenantId: z.string().min(1).max(64) })).max(100),
});

function onlyPortal(raw: string, headers: Headers) {
  const auth = verifyRequest(raw, headers);
  if (!auth.ok) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.product !== "portal") return { res: NextResponse.json({ error: "só o portal conecta WhatsApp de cliente" }, { status: 403 }) };
  return { res: null };
}

async function syncInBackground(connectionId: string, wabaId: string, token: string, products: string[]) {
  try {
    const r = await syncTemplates(wabaId, token, products);
    const erros = r.filter((x) => x.result === "erro");
    await db.whatsappConnection.update({ where: { id: connectionId }, data: { templatesSyncedAt: new Date(), lastError: erros.length ? `${erros.length} template(s) não criados: ${erros[0].error}`.slice(0, 500) : null } });
  } catch (e) {
    await db.whatsappConnection.update({ where: { id: connectionId }, data: { lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500) } });
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const guard = onlyPortal(raw, req.headers);
  if (guard.res) return guard.res;
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "corpo inválido", issues: parsed.error.issues }, { status: 400 });
  const { accountRef, code, wabaId, phoneNumberId, targets } = parsed.data;

  let conn = await db.whatsappConnection.findUnique({ where: { accountRef } });
  let token: string;
  try {
    if (code) {
      if (!wabaId || !phoneNumberId) return NextResponse.json({ error: "wabaId e phoneNumberId são obrigatórios com o code" }, { status: 422 });
      token = await exchangeCode(code);
      const phone = await registerPhone(phoneNumberId, token);
      await subscribeApp(wabaId, token);
      const displayPhone = normalizePhone(`+${(phone.display_phone_number ?? "").replace(/\D/g, "")}`);
      if (!displayPhone) return NextResponse.json({ error: "a Meta não devolveu o número do WhatsApp" }, { status: 502 });
      const data = { wabaId, phoneNumberId, displayPhone, verifiedName: phone.verified_name ?? null, tokenEnc: encryptSecret(token), status: "CONNECTED", lastError: null };
      conn = await db.whatsappConnection.upsert({ where: { accountRef }, update: data, create: { accountRef, ...data } });
    } else {
      if (!conn) return NextResponse.json({ error: "conta ainda não conectou o WhatsApp (envie o code do Embedded Signup)" }, { status: 409 });
      token = decryptSecret(conn.tokenEnc);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notify:connections]", accountRef, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // O número atende exatamente os estabelecimentos informados; os que saíram voltam ao número compartilhado.
  const manter = targets.map((t) => ({ product: t.product, tenantId: t.tenantId }));
  await db.tenantChannel.deleteMany({ where: { connectionId: conn.id, NOT: manter.length ? { OR: manter } : undefined } });
  for (const t of manter) {
    await db.tenantChannel.upsert({
      where: { product_tenantId: t },
      update: { provider: "meta", fromPhone: conn.displayPhone, connectionId: conn.id, active: true },
      create: { ...t, provider: "meta", fromPhone: conn.displayPhone, connectionId: conn.id, active: true },
    });
  }
  void syncInBackground(conn.id, conn.wabaId, token, [...new Set(manter.map((t) => t.product))]);
  return NextResponse.json({ connected: true, displayPhone: conn.displayPhone, verifiedName: conn.verifiedName, targets: manter.length, templatesSync: "iniciada" });
}

export async function GET(req: Request) {
  const guard = onlyPortal("", req.headers);
  if (guard.res) return guard.res;
  const accountRef = new URL(req.url).searchParams.get("accountRef") ?? "";
  if (!accountRef) return NextResponse.json({ error: "accountRef obrigatório" }, { status: 422 });
  const conn = await db.whatsappConnection.findUnique({ where: { accountRef }, include: { channels: { select: { product: true, tenantId: true, active: true } } } });
  if (!conn) return NextResponse.json({ connected: false });
  let templates: { name: string; status: string }[] = [];
  let health: string | null = null;
  try {
    const token = decryptSecret(conn.tokenEnc);
    const [remote, phone, wanted] = await Promise.all([listTemplates(conn.wabaId, token), getPhone(conn.phoneNumberId, token), templatesFor([...new Set(conn.channels.map((c) => c.product))])]);
    templates = wanted.map((w) => ({ name: w.name, status: remote.find((r) => r.name === w.name && r.language === w.language)?.status ?? "NOT_CREATED" }));
    health = phone.quality_rating ?? null;
  } catch (e) {
    health = null;
    await db.whatsappConnection.update({ where: { id: conn.id }, data: { status: "ERROR", lastError: (e instanceof Error ? e.message : String(e)).slice(0, 500) } });
  }
  const fresh = await db.whatsappConnection.findUniqueOrThrow({ where: { id: conn.id }, select: { status: true, lastError: true, templatesSyncedAt: true } });
  return NextResponse.json({ connected: true, displayPhone: conn.displayPhone, verifiedName: conn.verifiedName, quality: health, status: fresh.status, lastError: fresh.lastError, templatesSyncedAt: fresh.templatesSyncedAt, channels: conn.channels, templates });
}

export async function DELETE(req: Request) {
  const guard = onlyPortal("", req.headers);
  if (guard.res) return guard.res;
  const accountRef = new URL(req.url).searchParams.get("accountRef") ?? "";
  if (!accountRef) return NextResponse.json({ error: "accountRef obrigatório" }, { status: 422 });
  const conn = await db.whatsappConnection.findUnique({ where: { accountRef }, select: { id: true } });
  if (conn) {
    await db.tenantChannel.deleteMany({ where: { connectionId: conn.id } });
    await db.whatsappConnection.delete({ where: { id: conn.id } });
  }
  return NextResponse.json({ ok: true });
}
