import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM para o token do negócio de cada cliente (chave: NOTIFY_ENC_KEY, 32 bytes em hex ou base64). */
function key(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.NOTIFY_ENC_KEY ?? "";
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("NOTIFY_ENC_KEY não configurada (32 bytes em hex ou base64)");
  return buf;
}

export function encryptSecret(plain: string, env?: Record<string, string | undefined>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(env), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(token: string, env?: Record<string, string | undefined>): string {
  const [v, iv, tag, ct] = token.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("segredo cifrado inválido");
  const d = createDecipheriv("aes-256-gcm", key(env), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
