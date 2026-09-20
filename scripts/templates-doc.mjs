// Gera docs/TEMPLATES-META.md a partir do catálogo (src/lib/templates.ts): pronto para copiar no Gerenciador do WhatsApp
//   npx tsx scripts/templates-doc.mjs
import { writeFileSync } from "node:fs";
import { TEMPLATES } from "../src/lib/templates.ts";

const secoes = Object.values(TEMPLATES).map((t) => {
  const vars = t.params.map((p, i) => `| {{${i + 1}}} | \`${p}\` | ${t.example[i]} |`).join("\n");
  const botoes = (t.buttons ?? []).map((b, i) => b.type === "quick_reply" ? `${i + 1}. **Resposta rápida** — texto: \`${b.text}\`` : `${i + 1}. **Acessar site** — texto: \`${b.text}\`, tipo de URL: **Dinâmica**, URL: \`${b.base}{{1}}\` (exemplo: \`${b.base}nail/studio-ana\`)`).join("\n");
  return `### ${t.name}

*Quando:* ${t.quando}.

- **Categoria:** Utilidade (UTILITY) · **Idioma:** Português (BR) · **Nome:** \`${t.name}\`
- **Corpo** (cole exatamente):

\`\`\`
${t.body}
\`\`\`

| Variável | Conteúdo | Exemplo para aprovação |
|---|---|---|
${vars}
${botoes ? `\n**Botões** (nesta ordem):\n${botoes}\n` : ""}`;
}).join("\n");

const doc = `# Templates unificados da Heeca (WhatsApp Business / Meta)

Um conjunto por **evento**, neutro de segmento — todos os produtos usam os mesmos nomes na WABA "Heeca" (gerado de \`src/lib/templates.ts\`; não edite à mão: \`npx tsx scripts/templates-doc.mjs\`).

Cadastro: Meta Business Suite → WhatsApp Manager → Modelos de mensagem → Criar modelo. Ou automático quando a WABA existir: \`node scripts/meta-templates.mjs\` (usa \`WHATSAPP_BUSINESS_ACCOUNT_ID\` e \`WHATSAPP_ACCESS_TOKEN\`).

Regras que a Meta aplica na aprovação: categoria **Utilidade** (transacional; nada promocional), variáveis não podem começar nem terminar o corpo com espaço, botões de URL com base fixa (\`https://heeca.com.br/a/\` agenda; \`https://heeca.com.br/p/\` pagamento — o portal redireciona para o host do produto), até 3 botões, textos de botão ≤ 25 caracteres.

Templates específicos de um produto (ex.: orçamento do Ink, pós-procedimento do Piercing) ficam declarados no produto com nome \`heeca_<produto>_*\` e são cadastrados na mesma WABA.

${secoes}
`;
writeFileSync(new URL("../docs/TEMPLATES-META.md", import.meta.url), doc);
console.log(`ok: docs/TEMPLATES-META.md (${Object.keys(TEMPLATES).length} templates)`);
