import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { TwilioProvider } from "../src/lib/providers/twilio";

describe("webhook da Twilio → eventos", () => {
  it("mensagem recebida (texto)", () => {
    const form = new URLSearchParams({ MessageSid: "SM1", From: "whatsapp:+5511999998888", Body: "ok" });
    const ev = TwilioProvider.parseWebhook(form);
    assert.deepEqual(ev, [{ type: "text", from: "+5511999998888", text: "ok", providerMessageId: "SM1" }]);
  });

  it("resposta a botão de Content Template", () => {
    const form = new URLSearchParams({ MessageSid: "SM2", From: "whatsapp:+5511999998888", ButtonPayload: "confirm:tok1" });
    const ev = TwilioProvider.parseWebhook(form);
    assert.deepEqual(ev, [{ type: "button_reply", from: "+5511999998888", buttonId: "confirm:tok1", providerMessageId: "SM2" }]);
  });

  it("callback de status: entregue e falha com código", () => {
    const entregue = TwilioProvider.parseWebhook(new URLSearchParams({ MessageSid: "SM3", MessageStatus: "delivered" }));
    assert.deepEqual(entregue, [{ type: "status", providerMessageId: "SM3", status: "delivered", error: undefined }]);

    const falha = TwilioProvider.parseWebhook(new URLSearchParams({ MessageSid: "SM4", MessageStatus: "failed", ErrorCode: "63016" }));
    assert.deepEqual(falha, [{ type: "status", providerMessageId: "SM4", status: "failed", error: "Twilio error 63016" }]);
  });

  it("status desconhecido (ex.: 'queued', 'sending') não vira evento", () => {
    const ev = TwilioProvider.parseWebhook(new URLSearchParams({ MessageSid: "SM5", MessageStatus: "queued" }));
    assert.deepEqual(ev, []);
  });

  it("sem MessageSid não vira evento", () => {
    assert.deepEqual(TwilioProvider.parseWebhook(new URLSearchParams({ Body: "ok" })), []);
  });
});

describe("assinatura do webhook da Twilio", () => {
  const authToken = "segredo-de-teste-32-caracteres!!";
  const url = "https://notify.heeca.com.br/api/webhooks/twilio";
  const params = { MessageSid: "SM1", From: "whatsapp:+5511999998888", Body: "ok" };

  function assinar(token: string, url: string, params: Record<string, string>) {
    const base = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
    return createHmac("sha1", token).update(base, "utf8").digest("base64");
  }

  it("aceita a assinatura calculada com o mesmo algoritmo da Twilio", () => {
    assert.equal(TwilioProvider.validSignature(authToken, url, params, assinar(authToken, url, params)), true);
  });
  it("recusa segredo errado", () => {
    assert.equal(TwilioProvider.validSignature("outro-segredo-32-caracteres!!!!", url, params, assinar(authToken, url, params)), false);
  });
  it("recusa corpo alterado (um parâmetro a mais não assinado)", () => {
    const adulterado = { ...params, Body: "outra coisa" };
    assert.equal(TwilioProvider.validSignature(authToken, url, adulterado, assinar(authToken, url, params)), false);
  });
  it("recusa header ausente", () => {
    assert.equal(TwilioProvider.validSignature(authToken, url, params, null), false);
  });
});
