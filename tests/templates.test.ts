import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderBody, TEMPLATES, validateTemplate } from "../src/lib/templates";

describe("catálogo unificado", () => {
  it("todo template tem nome = chave, params batendo com o corpo e exemplo completo", () => {
    for (const [k, t] of Object.entries(TEMPLATES)) {
      assert.equal(t.name, k);
      const n = Math.max(...[...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
      assert.equal(n, t.params.length, `${k}: corpo usa {{1..${n}}}, params tem ${t.params.length}`);
      assert.equal(t.example.length, t.params.length, `${k}: exemplo incompleto`);
      assert.ok((t.buttons ?? []).length <= 3);
      assert.ok(t.body.length <= 1024);
      for (const b of t.buttons ?? []) assert.ok(b.text.length <= 25, `${k}: botão longo`);
    }
  });
  it("renderBody preenche na ordem", () => {
    assert.equal(renderBody(TEMPLATES.heeca_remarcado, ["Studio", "Gel", "21/09", "15:00"]), "Aviso de Studio: Seu horário de Gel foi remarcado para 21/09 às 15:00. Qualquer dúvida, responda esta mensagem.");
  });
  it("validação: nome fora do catálogo, contagem de params e botões", () => {
    assert.equal(validateTemplate("ink", "heeca_lembrete", ["a", "b", "c", "d", "e"], [{ type: "quick_reply" }, { type: "quick_reply" }]), null);
    assert.match(validateTemplate("ink", "heeca_lembrete", ["a"], []) ?? "", /espera 5/);
    assert.match(validateTemplate("ink", "heeca_lembrete", ["a", "b", "c", "d", "e"], []) ?? "", /botões/);
    assert.match(validateTemplate("ink", "heeca_inventado", [], []) ?? "", /catálogo/);
    assert.equal(validateTemplate("ink", "heeca_ink_orcamento", ["x"], []), null); // específico de produto: passa
    assert.match(validateTemplate("kids", "heeca_ink_orcamento", ["x"], []) ?? "", /catálogo/); // produto errado: não passa
    assert.equal(validateTemplate("kids", "heeca_kids_matricula", ["x"], []), null); // Kids agora passa (achado real 28/09: lista fixa não incluía kids/atelier/pet/make/service)
    assert.match(validateTemplate("ink", "Promo!", [], []) ?? "", /inválido/);
  });
});

describe("regras de aprovação da Meta", () => {
  it("nenhum corpo começa ou termina com variável", () => {
    for (const t of Object.values(TEMPLATES)) {
      assert.doesNotMatch(t.body, /^\{\{\d+\}\}/, `${t.name} começa com variável`);
      assert.doesNotMatch(t.body, /\{\{\d+\}\}\s*$/, `${t.name} termina com variável`);
    }
  });
});
