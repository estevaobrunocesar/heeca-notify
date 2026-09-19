import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Autenticação servidor → servidor, o mesmo esquema do contrato de entitlement da plataforma:
 * `X-Heeca-Product` diz quem é; `X-Heeca-Timestamp` + `X-Heeca-Signature` = HMAC-SHA256(`${ts}.${corpo}`)
 * com o segredo daquele produto (NOTIFY_SECRET_<PRODUTO>). Um segredo por produto: comprometer um
 * não permite falar em nome de outro. Puro (sem banco) — testável.
 */
export const MAX_SKEW_MS = 5 * 60 * 1000;

export function secretFor(product: string, env: Record<string, string | undefined> = process.env): string | null {
  const key = `NOTIFY_SECRET_${product.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const s = env[key];
  return s && s.length >= 16 ? s : null;
}

export function sign(secret: string, rawBody: string, ts = Date.now()) {
  return { ts: String(ts), sig: createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex") };
}

export type AuthResult = { ok: true; product: string } | { ok: false; status: number; error: string };

export function verifyRequest(rawBody: string, headers: Headers, env: Record<string, string | undefined> = process.env, now = Date.now()): AuthResult {
  const product = (headers.get("x-heeca-product") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,32}$/.test(product)) return { ok: false, status: 401, error: "produto ausente" };
  const secret = secretFor(product, env);
  if (!secret) return { ok: false, status: 401, error: `produto ${product} não cadastrado no Notify` };
  const ts = headers.get("x-heeca-timestamp") ?? "";
  const sig = headers.get("x-heeca-signature") ?? "";
  if (!/^\d+$/.test(ts) || Math.abs(now - Number(ts)) > MAX_SKEW_MS) return { ok: false, status: 401, error: "assinatura expirada" };
  const expected = sign(secret, rawBody, Number(ts)).sig;
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return { ok: false, status: 401, error: "assinatura inválida" };
  return { ok: true, product };
}

/** Cabeçalhos para o Notify chamar o produto de volta (callback) — mesmo esquema, mesmo segredo. */
export function signedHeaders(product: string, secret: string, rawBody: string): Record<string, string> {
  const { ts, sig } = sign(secret, rawBody);
  return { "Content-Type": "application/json", "X-Heeca-Product": product, "X-Heeca-Timestamp": ts, "X-Heeca-Signature": sig, "User-Agent": "HeecaNotify/1.0 (+https://heeca.com.br)" };
}
