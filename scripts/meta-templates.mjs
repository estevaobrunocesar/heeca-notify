// Cadastra/atualiza os templates unificados na WABA pela Graph API (quando a conta existir — D10).
//   WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_ACCESS_TOKEN=... node scripts/meta-templates.mjs [--dry]
// Idempotente: pula os que já existem com o mesmo nome (a Meta não deixa editar corpo aprovado; para mudar texto, crie outro nome).
import { TEMPLATES } from "../src/lib/templates.ts";

const WABA = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, TOKEN = process.env.WHATSAPP_ACCESS_TOKEN, DRY = process.argv.includes("--dry");
if (!DRY && (!WABA || !TOKEN)) { console.error("defina WHATSAPP_BUSINESS_ACCOUNT_ID e WHATSAPP_ACCESS_TOKEN (ou use --dry)"); process.exit(1); }
const GRAPH = "https://graph.facebook.com/v21.0";
const api = async (path, init = {}) => { const r = await fetch(`${GRAPH}${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }); const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error ?? j)); return j; };

const toMeta = (t) => ({
  name: t.name, category: t.category, language: t.language, allow_category_change: false,
  components: [
    { type: "BODY", text: t.body, example: { body_text: [t.example] } },
    ...(t.buttons?.length ? [{ type: "BUTTONS", buttons: t.buttons.map((b) => b.type === "quick_reply" ? { type: "QUICK_REPLY", text: b.text } : { type: "URL", text: b.text, url: `${b.base}{{1}}`, example: [`${b.base}nail/studio-ana`] }) }] : []),
  ],
});

const existentes = DRY ? [] : (await api(`/${WABA}/message_templates?fields=name,status,language&limit=200`)).data ?? [];
for (const t of Object.values(TEMPLATES)) {
  const payload = toMeta(t);
  const ja = existentes.find((e) => e.name === t.name && e.language === t.language);
  if (ja) { console.log(`= ${t.name}: ${ja.status}`); continue; }
  if (DRY) { console.log(`+ ${t.name} (dry)`); console.log(JSON.stringify(payload, null, 1).slice(0, 400)); continue; }
  const r = await api(`/${WABA}/message_templates`, { method: "POST", body: JSON.stringify(payload) });
  console.log(`+ ${t.name}: ${r.status ?? "enviado"} (${r.id})`);
}
