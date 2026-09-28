// Cadastra/atualiza os templates unificados como Content Templates na Twilio e envia para aprovação
// WhatsApp. Mesma fonte (src/lib/templates.ts) que scripts/meta-templates.mjs.
//   TWILIO_ACCOUNT_SID=... TWILIO_API_KEY_SID=... TWILIO_API_KEY_SECRET=... node scripts/twilio-create-templates.mjs [--dry]
// Idempotente: pula (por friendly_name) o que já existe. Content Template aprovado não pode mudar
// de corpo — para mudar texto, crie outro nome (mesma regra do catálogo unificado para a Meta).
import { TEMPLATES } from "../src/lib/templates.ts";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DRY = process.argv.includes("--dry");

const authUser = API_KEY_SID || ACCOUNT_SID;
const authPass = API_KEY_SECRET || AUTH_TOKEN;
if (!DRY && (!ACCOUNT_SID || !authPass)) {
  console.error("defina TWILIO_ACCOUNT_SID e (TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET ou TWILIO_AUTH_TOKEN), ou use --dry");
  process.exit(1);
}

const CONTENT_API = "https://content.twilio.com/v1";
const auth = () => "Basic " + Buffer.from(`${authUser}:${authPass}`).toString("base64");

async function api(path, init = {}) {
  const res = await fetch(`${CONTENT_API}${path}`, { ...init, headers: { Authorization: auth(), "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio Content API (${json.code ?? res.status}): ${json.message ?? res.statusText}`);
  return json;
}

// Slug estável para o "id" de um botão de resposta rápida — Twilio devolve esse id como
// ButtonPayload no webhook (ver TwilioProvider.parseWebhook).
const slug = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function toContent(spec) {
  const variables = {};
  spec.example.forEach((v, i) => { variables[String(i + 1)] = v; });

  const quickReplies = (spec.buttons ?? []).filter((b) => b.type === "quick_reply");
  const urlButton = (spec.buttons ?? []).find((b) => b.type === "url");

  let types;
  if (urlButton) {
    // Sufixo dinâmico do link (ex.: "nail/ana-nails") entra como a variável seguinte ao último
    // parâmetro do corpo — mesmo índice que TwilioProvider.sendTemplate preenche em tempo de envio.
    const suffixVar = String(spec.params.length + 1);
    variables[suffixVar] = "nail/studio-ana";
    types = { "twilio/call-to-action": { body: spec.body, actions: [{ type: "URL", title: urlButton.text, url: `${urlButton.base}{{${suffixVar}}}` }] } };
  } else if (quickReplies.length) {
    types = { "twilio/quick-reply": { body: spec.body, actions: quickReplies.map((b) => ({ title: b.text, id: slug(b.text) })) } };
  } else {
    types = { "twilio/text": { body: spec.body } };
  }

  return { friendly_name: spec.name, language: spec.language, variables, types };
}

const existentes = DRY ? [] : (await api("/Content?PageSize=1000")).contents ?? [];
for (const spec of Object.values(TEMPLATES)) {
  const payload = toContent(spec);
  const ja = existentes.find((c) => c.friendly_name === spec.name && c.language === spec.language);
  if (ja) { console.log(`= ${spec.name}: já existe (ContentSid ${ja.sid}) — não recriado`); continue; }
  if (DRY) { console.log(`+ ${spec.name} (dry)`); console.log(JSON.stringify(payload, null, 1).slice(0, 500)); continue; }

  const created = await api("/Content", { method: "POST", body: JSON.stringify(payload) });
  console.log(`+ ${spec.name}: criado (ContentSid ${created.sid})`);

  try {
    const approval = await api(`/Content/${created.sid}/ApprovalRequests/whatsapp`, {
      method: "POST",
      body: JSON.stringify({ name: spec.name, category: spec.category }),
    });
    console.log(`  enviado para aprovação WhatsApp: ${approval.status ?? "pending"}`);
  } catch (err) {
    console.log(`  aviso: falha ao pedir aprovação automática (${err.message}) — peça manualmente no Console (Content Template Builder → Submit for WhatsApp Approval)`);
  }

  console.log(`  defina: TWILIO_CONTENT_SID_${spec.name.toUpperCase()}=${created.sid}`);
}

console.log("\nAprovação da Meta para templates Twilio costuma levar minutos a poucas horas. Confira o status em:");
console.log("Twilio Console → Messaging → Content Template Builder.");
