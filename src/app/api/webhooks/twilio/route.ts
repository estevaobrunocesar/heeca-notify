import { NextResponse } from "next/server";
import { TwilioProvider } from "@/lib/providers/twilio";
import { routeEvent } from "@/lib/inbound";

export const dynamic = "force-dynamic";

/**
 * Webhook da Twilio: um único endpoint recebe tanto mensagem recebida (configurado em "When a
 * message comes in") quanto status de entrega (StatusCallback) — os dois chegam como
 * application/x-www-form-urlencoded, distinguidos dentro de TwilioProvider.parseWebhook.
 * Responde 200 rápido; a Twilio reenvia em erro (mesma convenção do webhook da Meta).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const form = new URLSearchParams(raw);
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  // A assinatura da Twilio é sobre a URL PÚBLICA cadastrada no console dela — atrás do proxy,
  // req.url traz a origem interna do container (mesmo achado do appUrl do Nutri em 24/09).
  const publicUrl = new URL(new URL(req.url).pathname, process.env.APP_URL ?? req.url).toString();
  const valid = TwilioProvider.validSignature(authToken, publicUrl, Object.fromEntries(form), req.headers.get("x-twilio-signature"));
  if (!valid && process.env.NODE_ENV === "production") return new Response("invalid signature", { status: 401 });

  let events;
  try {
    events = TwilioProvider.parseWebhook(form);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  for (const ev of events) {
    try {
      await routeEvent(ev);
    } catch (err) {
      console.error("[notify:webhook:twilio]", ev.type, err);
    }
  }
  return NextResponse.json({ ok: true, events: events.length });
}
