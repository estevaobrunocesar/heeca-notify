// Registra no Notify os templates ESPECÍFICOS de cada produto (heeca_<produto>_*), lendo a definição que o
// próprio produto já mantém. O Notify então cria esses templates também na WABA de cada cliente que conectar
// o próprio WhatsApp (D11). Os unificados (heeca_confirmacao…) NÃO passam por aqui: vêm de src/lib/templates.ts.
//
//   npx tsx scripts/register-product-templates.mjs                 # dry-run: valida e mostra o que seria enviado
//   npx tsx scripts/register-product-templates.mjs --only=ink,mind # só alguns produtos
//   NOTIFY_URL=https://notify.heeca.com.br npx tsx scripts/register-product-templates.mjs --apply
//
// Segredos: lidos de NOTIFY_SECRET_<PRODUTO> no ambiente ou de ../infra/production.env (ignorado pelo git).
// Idempotente: o Notify atualiza por (produto, nome). Mudar o texto de um template já aprovado exige nome novo (regra 7).
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TEMPLATES as UNIFIED } from "../src/lib/templates.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.PRODUCTS_ROOT ?? join(here, "..", ".."));
const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const NOTIFY_URL = (process.env.NOTIFY_URL ?? "https://notify.heeca.com.br").replace(/\/$/, "");

const secrets = { ...process.env };
const secretsFile = join(ROOT, "infra", "production.env");
if (existsSync(secretsFile)) for (const l of readFileSync(secretsFile, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in secrets)) secrets[m[1]] = m[2]; }

const load = (relPath) => import(pathToFileURL(join(ROOT, relPath)).href);

// Valores de exemplo (a Meta exige exemplo para aprovar) por nome de variável. Sem entrada → "Exemplo".
const EXEMPLO = {
  patientFirstName: "Maria", cliente: "Maria", clienteNome: "Maria", client: "Maria",
  professionalName: "Dra. Ana", profissional: "Dra. Ana", establishment: "Studio Ana", estabelecimento: "Studio Ana", atelierNome: "Ateliê Ana",
  date: "20/09/2026", data: "20/09/2026", time: "14:00", hora: "14:00", serviceName: "Atendimento", servico: "Atendimento", modality: "Online", platform: "Google Meet",
  holdHours: "2", documentTitle: "Termo de consentimento", formTitle: "Ficha inicial", prazo: "15 dias", valor: "R$ 150,00", projeto: "Projeto",
};
const exemploDe = (nome) => EXEMPLO[nome] ?? "Exemplo";

const issues = [];
const bodyProblem = (name, body, params) => {
  const n = Math.max(0, ...[...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
  if (n !== params.length) return `usa {{1..${n}}} mas tem ${params.length} parâmetro(s)`;
  if (/^\{\{\d+\}\}/.test(body.trim()) || /\{\{\d+\}\}\s*$/.test(body.trim())) return "começa ou termina com variável (a Meta recusa)";
  if (body.length > 1024) return "corpo acima de 1024 caracteres";
  return null;
};
const spec = (product, p) => ({ name: p.name, category: p.category ?? "UTILITY", language: "pt_BR", body: p.body, params: p.params, ...(p.buttons?.length ? { buttons: p.buttons } : {}), example: p.example, quando: p.quando ?? `específico do produto ${product}` });

// ── Família meta-templates.ts (Ink, Piercing, Make, Bronze): META_TEMPLATES com defaultName/body/params/example/buttons ──
async function metaFamily(product) {
  const { META_TEMPLATES } = await load(`heeca_${product}/src/lib/whatsapp/meta-templates.ts`);
  return Object.values(META_TEMPLATES).filter((t) => t.defaultName.startsWith(`heeca_${product}_`)).map((t) => spec(product, {
    name: t.defaultName, category: t.category, body: t.body, params: t.params, example: t.example,
    buttons: (t.buttons ?? []).map((b) => (b.type === "quick_reply" ? { type: "quick_reply", text: b.text } : { type: "url", text: b.text, base: b.urlPrefix })),
  }));
}

// ── Família templates.ts com reference/variables (Mind, Nutri, Atelier, Move) ──
async function referenceFamily(product, file, host, { unifiedFlag = true } = {}) {
  const mod = await load(file);
  const paths = mod.URL_PATH_BY_SUFFIX ?? {};
  return Object.values(mod.TEMPLATES).filter((t) => t.name.startsWith(`heeca_${product}_`) && !(unifiedFlag && t.unified)).map((t) => {
    const buttons = [];
    for (const b of t.buttons ?? []) {
      if (b.type === "quick_reply") buttons.push({ type: "quick_reply", text: b.intent === "confirm" ? "Confirmar" : b.intent === "reschedule" ? "Remarcar" : "Cancelar" });
      else buttons.push({ type: "url", text: b.label, base: `${host}${paths[b.suffix] ?? ""}` });
    }
    if (t.urlButton) buttons.push({ type: "url", text: "Confirmar horário", base: `${host}${t.urlButton.baseUrl}` });
    return spec(product, { name: t.name, body: t.reference, params: [...t.variables], example: t.variables.map(exemploDe), buttons });
  });
}

// ── Kids: definição ainda só em script de criação na Twilio; textos finais (reestruturados em 29/09) ──
const kids = async () => [
  ["heeca_kids_entrada", "Mensagem de {{3}}: Olá, {{1}}! {{2}} chegou agora às {{4}} e já está com a nossa equipe. Tenha um ótimo dia!", ["responsavel", "crianca", "creche", "hora"], ["Maria", "Sofia", "Cantinho Feliz", "07:45"]],
  ["heeca_kids_saida", "Mensagem de {{3}}: Olá, {{1}}! {{2}} saiu agora às {{4}}, retirada por {{5}}. Até a próxima!", ["responsavel", "crianca", "creche", "hora", "retirada_por"], ["Maria", "Sofia", "Cantinho Feliz", "17:30", "Ana (avó)"]],
  ["heeca_kids_resumo_dia", "Mensagem de {{2}}: Resumo do dia de {{1}}: {{3}} Qualquer dúvida, é só responder esta mensagem.", ["crianca", "creche", "resumo"], ["Sofia", "Cantinho Feliz", "Almoço: consumiu tudo. Soneca: 13h-14h20. Fralda trocada 2x."]],
  ["heeca_kids_mensalidade_vencendo", "Mensagem de {{3}}: Olá, {{1}}! A mensalidade de {{2}} no valor de {{4}} vence amanhã, {{5}}. Evite juros pagando em dia.", ["responsavel", "crianca", "creche", "valor", "vencimento"], ["Carlos", "Sofia", "Cantinho Feliz", "R$ 890,00", "05/10/2026"]],
  ["heeca_kids_mensalidade_atrasada", "Mensagem de {{3}}: Olá, {{1}}! A mensalidade de {{2}} no valor de {{4}}, vencida em {{5}}, está em atraso. Regularize para evitar a suspensão do atendimento.", ["responsavel", "crianca", "creche", "valor", "vencimento"], ["Carlos", "Sofia", "Cantinho Feliz", "R$ 890,00", "05/10/2026"]],
].map(([name, body, params, example]) => spec("kids", { name, body, params, example }));

const PRODUCTS = {
  ink: () => metaFamily("ink"),
  piercing: () => metaFamily("piercing"),
  make: () => metaFamily("make"),
  bronze: () => metaFamily("bronze"),
  mind: () => referenceFamily("mind", "hecca_psico/src/lib/whatsapp/templates.ts", "https://mind.heeca.com.br"),
  nutri: () => referenceFamily("nutri", "heeca_nutri/src/lib/whatsapp/templates.ts", "https://nutri.heeca.com.br"),
  atelier: () => referenceFamily("atelier", "hecca_atelier/src/lib/whatsapp/templates.ts", "https://atelier.heeca.com.br", { unifiedFlag: false }),
  move: () => referenceFamily("move", "heeca_move/src/lib/whatsapp/templates.ts", "https://move.heeca.com.br", { unifiedFlag: false }),
  kids,
};

async function post(product, templates) {
  const secret = secrets[`NOTIFY_SECRET_${product.toUpperCase()}`];
  if (!secret) throw new Error(`sem NOTIFY_SECRET_${product.toUpperCase()}`);
  const raw = JSON.stringify({ templates });
  const ts = String(Date.now());
  const res = await fetch(`${NOTIFY_URL}/api/v1/templates`, {
    method: "POST", body: raw,
    headers: { "Content-Type": "application/json", "User-Agent": "HeecaRegisterTemplates/1.0", "X-Heeca-Product": product, "X-Heeca-Timestamp": ts, "X-Heeca-Signature": createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex") },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${j.error ?? ""} ${j.issues ? JSON.stringify(j.issues[0]) : ""}`);
  return j.registered;
}

let total = 0, bad = 0;
for (const [product, load_] of Object.entries(PRODUCTS)) {
  if (ONLY.length && !ONLY.includes(product)) continue;
  let list;
  try { list = await load_(); } catch (e) { console.log(`✖ ${product}: não consegui ler a definição (${e.message})`); bad++; continue; }
  const ok = [];
  for (const t of list) {
    if (t.name in UNIFIED) continue;
    const problema = bodyProblem(t.name, t.body, t.params) ?? (t.example.length !== t.params.length ? "exemplos não batem com os parâmetros" : null) ?? ((t.buttons ?? []).find((b) => b.type === "url" && !/^https:\/\//.test(b.base)) ? "botão de URL sem base https" : null);
    if (problema) { console.log(`  ✖ ${t.name}: ${problema}`); issues.push(`${t.name}: ${problema}`); bad++; continue; }
    ok.push(t);
  }
  total += ok.length;
  console.log(`${APPLY ? "→" : "·"} ${product}: ${ok.length} válido(s) de ${list.length}${ok.length ? ` — ${ok.map((t) => t.name.replace(`heeca_${product}_`, "")).join(", ")}` : ""}`);
  if (APPLY && ok.length) {
    try { const r = await post(product, ok); console.log(`  ✔ registrados no Notify: ${r.length}`); } catch (e) { console.log(`  ✖ Notify recusou: ${e.message}`); bad++; }
  }
}
console.log(`\n${APPLY ? "Registrados" : "Dry-run — válidos"}: ${total} · problemas: ${bad}${APPLY ? "" : "  (use --apply para enviar)"}`);
process.exit(bad ? 1 : 0);
