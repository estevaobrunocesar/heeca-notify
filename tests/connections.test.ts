import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { TEMPLATES, toMetaTemplate } from "../src/lib/templates";
import { MetaCloudProvider } from "../src/lib/providers/meta";

const env = { NOTIFY_ENC_KEY: "a".repeat(64) };

describe("cofre do token do cliente", () => {
  it("cifra e decifra; cada cifra é única; adulteração e chave errada falham", () => {
    const a = encryptSecret("EAAB-token", env), b = encryptSecret("EAAB-token", env);
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a, env), "EAAB-token");
    assert.throws(() => decryptSecret(a.slice(0, -2) + "xx", env));
    assert.throws(() => decryptSecret(a, { NOTIFY_ENC_KEY: "b".repeat(64) }));
  });
  it("sem chave configurada é erro claro", () => {
    assert.throws(() => encryptSecret("x", {}), /NOTIFY_ENC_KEY/);
  });
});

describe("template na WABA do cliente", () => {
  it("toMetaTemplate gera corpo + botões como a Meta exige", () => {
    const p = toMetaTemplate(TEMPLATES.heeca_cancelado);
    assert.equal(p.name, "heeca_cancelado");
    assert.equal(p.components[0].type, "BODY");
    assert.deepEqual(p.components[1], { type: "BUTTONS", buttons: [{ type: "URL", text: "Agendar novamente", url: "https://heeca.com.br/a/{{1}}", example: ["https://heeca.com.br/a/nail/studio-ana"] }] });
    assert.equal(toMetaTemplate(TEMPLATES.heeca_remarcado).components.length, 1);
  });
});

describe("webhook da Meta com vários números", () => {
  it("cada evento carrega o phone_number_id de quem recebeu", () => {
    const ev = MetaCloudProvider.parseWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "999" }, messages: [{ id: "m1", from: "5511999998888", type: "text", text: { body: "oi" } }], statuses: [{ id: "m0", status: "read" }] } }] }] });
    assert.deepEqual(ev.map((e) => e.phoneNumberId), ["999", "999"]);
  });
});
