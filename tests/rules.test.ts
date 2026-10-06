import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BACKOFF_MS, isOptOut, isPermanentError, MAX_ATTEMPTS, nextAttempt, normalizePhone, sharedChannelBlock } from "../src/lib/rules";
import { MetaCloudProvider } from "../src/lib/providers/meta";

describe("fila", () => {
  it("backoff cresce e desiste depois de MAX_ATTEMPTS", () => {
    const t0 = 1_000_000;
    assert.equal(nextAttempt(0, t0)!.getTime(), t0 + BACKOFF_MS[0]);
    assert.equal(nextAttempt(MAX_ATTEMPTS - 1, t0)!.getTime(), t0 + BACKOFF_MS[MAX_ATTEMPTS - 1]);
    assert.equal(nextAttempt(MAX_ATTEMPTS, t0), null);
  });
  it("erros permanentes da Meta não são repetidos", () => {
    assert.equal(isPermanentError("Meta API (131026): Message Undeliverable"), true);
    assert.equal(isPermanentError("Meta API (130429): Rate limit hit"), false);
    assert.equal(isPermanentError("fetch failed"), false);
  });
  it("telefone E.164", () => {
    assert.equal(normalizePhone("+55 (11) 99999-8888"), "+5511999998888");
    assert.equal(normalizePhone("11999998888"), null);
  });
  it("opt-out por palavra-chave", () => {
    assert.equal(isOptOut("PARAR"), true);
    assert.equal(isOptOut(" sair. "), true);
    assert.equal(isOptOut("parar de atrasar"), false);
  });
});

describe("webhook da Meta → eventos", () => {
  it("botão de template, texto com contexto e status", () => {
    const ev = MetaCloudProvider.parseWebhook({ entry: [{ changes: [{ value: {
      messages: [
        { id: "wamid.1", from: "5511999998888", type: "button", button: { payload: "confirm:tok1", text: "Confirmar" }, context: { id: "wamid.out1" } },
        { id: "wamid.2", from: "5511999998888", type: "text", text: { body: "ok" } },
      ],
      statuses: [{ id: "wamid.out1", status: "delivered" }, { id: "wamid.out2", status: "failed", errors: [{ title: "Number not on WhatsApp" }] }],
    } }] }] });
    assert.deepEqual(ev[0], { type: "button_reply", from: "+5511999998888", buttonId: "confirm:tok1", providerMessageId: "wamid.1", contextMessageId: "wamid.out1" });
    assert.equal(ev[1].type, "text");
    assert.deepEqual(ev[2], { type: "status", providerMessageId: "wamid.out1", status: "delivered", error: undefined });
    assert.equal((ev[3] as { error?: string }).error, "Number not on WhatsApp");
  });
});

describe("canal compartilhado desligado (WHATSAPP_PROVIDER=none)", () => {
  const ok = { active: true, provider: "meta", connectionStatus: "CONNECTED" };
  it("com outro provedor, nunca bloqueia", () => {
    assert.equal(sharedChannelBlock("twilio", null), null);
    assert.equal(sharedChannelBlock("console", null), null);
    assert.equal(sharedChannelBlock("meta", null), null);
  });
  it("com none, só passa estabelecimento com número Meta ativo e conectado", () => {
    assert.equal(sharedChannelBlock("none", ok), null);
    assert.equal(sharedChannelBlock(" NONE ", ok), null);
    assert.match(sharedChannelBlock("none", null) ?? "", /não configurado/);
    assert.match(sharedChannelBlock("none", { ...ok, active: false }) ?? "", /não configurado/);
    assert.match(sharedChannelBlock("none", { ...ok, connectionStatus: "ERROR" }) ?? "", /não configurado/);
    assert.match(sharedChannelBlock("none", { ...ok, provider: "twilio" }) ?? "", /não configurado/);
  });
  it("o motivo é erro permanente (não repete)", () => {
    assert.equal(isPermanentError(sharedChannelBlock("none", null) ?? ""), true);
  });
});
