import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_SKEW_MS, secretFor, sign, signedHeaders, verifyRequest } from "../src/lib/auth";

const env = { NOTIFY_SECRET_NAIL: "a".repeat(32), NOTIFY_SECRET_LASH: "b".repeat(32) };
const h = (product: string, ts: string, sig: string) => new Headers({ "x-heeca-product": product, "x-heeca-timestamp": ts, "x-heeca-signature": sig });

describe("autenticação por produto", () => {
  it("aceita assinatura válida do produto certo", () => {
    const { ts, sig } = sign(env.NOTIFY_SECRET_NAIL, '{"a":1}');
    assert.deepEqual(verifyRequest('{"a":1}', h("nail", ts, sig), env), { ok: true, product: "nail" });
  });
  it("segredo de um produto não vale para outro", () => {
    const { ts, sig } = sign(env.NOTIFY_SECRET_NAIL, "x");
    assert.equal(verifyRequest("x", h("lash", ts, sig), env).ok, false);
  });
  it("corpo alterado, produto desconhecido e timestamp velho são recusados", () => {
    const { ts, sig } = sign(env.NOTIFY_SECRET_NAIL, "x");
    assert.equal(verifyRequest("y", h("nail", ts, sig), env).ok, false);
    assert.equal(verifyRequest("x", h("dental", ts, sig), env).ok, false);
    const velho = sign(env.NOTIFY_SECRET_NAIL, "x", Date.now() - MAX_SKEW_MS - 1000);
    assert.equal(verifyRequest("x", h("nail", velho.ts, velho.sig), env).ok, false);
  });
  it("secretFor exige 16+ caracteres e normaliza o nome", () => {
    assert.equal(secretFor("nail", env), env.NOTIFY_SECRET_NAIL);
    assert.equal(secretFor("na-il", { NOTIFY_SECRET_NA_IL: "c".repeat(20) }), "c".repeat(20));
    assert.equal(secretFor("nail", { NOTIFY_SECRET_NAIL: "curto" }), null);
  });
  it("cabeçalhos do callback são verificáveis pelo mesmo esquema", () => {
    const hd = signedHeaders("nail", env.NOTIFY_SECRET_NAIL, "{}");
    assert.equal(verifyRequest("{}", new Headers(hd), env).ok, true);
  });
});
