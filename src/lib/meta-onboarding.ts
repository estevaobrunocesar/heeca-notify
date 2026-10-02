import "server-only";
import { randomInt } from "node:crypto";
import { db } from "./db";
import { TEMPLATES, toMetaTemplate, type TemplateSpec } from "./templates";

/**
 * Onboarding do WhatsApp do cliente (Embedded Signup, D11): troca o código do portal por um token do
 * negócio, registra o número, assina o webhook da Heeca na WABA dele e cria os templates lá.
 * Tudo que fala com a Meta em nome do cliente mora aqui — o portal só repassa o que o SDK devolveu.
 */
const GRAPH = process.env.META_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

type GraphError = { error?: { message: string; code?: number; error_subcode?: number } };

async function graph<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e ? `Meta API (${e.code ?? res.status}${e.error_subcode ? `/${e.error_subcode}` : ""}): ${e.message}` : `Meta API HTTP ${res.status}`);
  }
  return json;
}

export function appCredentials(env: Record<string, string | undefined> = process.env) {
  const id = env.META_APP_ID, secret = env.META_APP_SECRET ?? env.WHATSAPP_APP_SECRET;
  if (!id || !secret) throw new Error("META_APP_ID / META_APP_SECRET não configurados no Notify");
  return { id, secret };
}

export async function exchangeCode(code: string): Promise<string> {
  const { id, secret } = appCredentials();
  const q = new URLSearchParams({ client_id: id, client_secret: secret, code });
  const r = await graph<{ access_token?: string }>(`oauth/access_token?${q}`, null);
  if (!r.access_token) throw new Error("Meta não devolveu o token do negócio");
  return r.access_token;
}

export type PhoneInfo = { display_phone_number?: string; verified_name?: string; status?: string; quality_rating?: string };

export function getPhone(phoneNumberId: string, token: string) {
  return graph<PhoneInfo>(`${phoneNumberId}?fields=display_phone_number,verified_name,status,quality_rating`, token);
}

/** Registra o número na Cloud API. Número que o Embedded Signup já deixou conectado não precisa (e a Meta recusa de novo). */
export async function registerPhone(phoneNumberId: string, token: string) {
  const before = await getPhone(phoneNumberId, token);
  if (before.status === "CONNECTED") return before;
  const pin = String(randomInt(100000, 1000000));
  await graph(`${phoneNumberId}/register`, token, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
  return getPhone(phoneNumberId, token);
}

/** Faz a WABA do cliente entregar status e respostas no webhook do app Heeca (um webhook só para todos os clientes). */
export function subscribeApp(wabaId: string, token: string) {
  return graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });
}

export type RemoteTemplate = { name: string; language: string; status: string };

export async function listTemplates(wabaId: string, token: string): Promise<RemoteTemplate[]> {
  const r = await graph<{ data?: RemoteTemplate[] }>(`${wabaId}/message_templates?fields=name,status,language&limit=200`, token);
  return r.data ?? [];
}

/** Unificados + os específicos que os produtos do cliente registraram. */
export async function templatesFor(products: string[]): Promise<TemplateSpec[]> {
  const extras = products.length ? await db.productTemplate.findMany({ where: { product: { in: products } } }) : [];
  return [...Object.values(TEMPLATES), ...extras.map((e) => e.spec as unknown as TemplateSpec)];
}

export type SyncResult = { name: string; result: "criado" | "existente" | "erro"; status?: string; error?: string };

/** Cria na WABA do cliente o que falta. Idempotente; a Meta não deixa editar corpo aprovado, então existente = pula. */
export async function syncTemplates(wabaId: string, token: string, products: string[]): Promise<SyncResult[]> {
  const existentes = await listTemplates(wabaId, token);
  const out: SyncResult[] = [];
  for (const t of await templatesFor(products)) {
    const ja = existentes.find((e) => e.name === t.name && e.language === t.language);
    if (ja) { out.push({ name: t.name, result: "existente", status: ja.status }); continue; }
    try {
      const r = await graph<{ status?: string }>(`${wabaId}/message_templates`, token, { method: "POST", body: JSON.stringify(toMetaTemplate(t)) });
      out.push({ name: t.name, result: "criado", status: r.status ?? "PENDING" });
    } catch (e) {
      out.push({ name: t.name, result: "erro", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
