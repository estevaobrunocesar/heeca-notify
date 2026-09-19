import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MetaCloudProvider } from "@/lib/providers/meta";
import { routeEvent } from "@/lib/inbound";

export const dynamic = "force-dynamic";

/** Cadastro do webhook na Meta (GET com hub.challenge). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const verify = process.env.WHATSAPP_VERIFY_TOKEN;
  if (verify && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verify) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // em produção o segredo é obrigatório
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice(7);
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Eventos da Meta (status, botões, textos) → roteados ao produto dono da mensagem. Responde 200 rápido; a Meta reenvia em erro. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });
  let events;
  try {
    events = MetaCloudProvider.parseWebhook(JSON.parse(raw));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  for (const ev of events) {
    try {
      await routeEvent(ev);
    } catch (err) {
      console.error("[notify:webhook]", ev.type, err);
    }
  }
  return NextResponse.json({ ok: true, events: events.length });
}
