import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * O produto registra seus templates ESPECÍFICOS (heeca_<produto>_*) para o Notify criá-los também na WABA de
 * cada cliente que conectar o próprio WhatsApp (D11). Os unificados já vêm do catálogo do Notify. Idempotente:
 * mesmo nome = atualiza o registro (a Meta não edita corpo aprovado; mudar texto = nome novo, regra 7).
 */
const button = z.union([
  z.object({ type: z.literal("quick_reply"), text: z.string().min(1).max(25) }),
  z.object({ type: z.literal("url"), text: z.string().min(1).max(25), base: z.string().url().max(200) }),
]);
const spec = z.object({
  name: z.string().regex(/^heeca_[a-z0-9_]+$/),
  category: z.enum(["UTILITY", "MARKETING"]),
  language: z.literal("pt_BR"),
  body: z.string().min(1).max(1024),
  params: z.array(z.string()).max(20),
  buttons: z.array(button).max(3).optional(),
  example: z.array(z.string()).max(20),
  quando: z.string().max(300).default(""),
});

export async function POST(req: Request) {
  const raw = await req.text();
  const auth = verifyRequest(raw, req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const parsed = z.object({ templates: z.array(spec).min(1).max(50) }).safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "corpo inválido", issues: parsed.error.issues }, { status: 400 });
  for (const t of parsed.data.templates) {
    if (!t.name.startsWith(`heeca_${auth.product}_`)) return NextResponse.json({ error: `template ${t.name} não pertence ao produto ${auth.product}` }, { status: 422 });
    const n = Math.max(0, ...[...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
    if (n !== t.params.length || t.example.length !== t.params.length) return NextResponse.json({ error: `${t.name}: parâmetros e exemplos precisam bater com o corpo` }, { status: 422 });
    if (/^\{\{\d+\}\}/.test(t.body) || /\{\{\d+\}\}\s*$/.test(t.body)) return NextResponse.json({ error: `${t.name}: a Meta recusa corpo que começa ou termina com variável` }, { status: 422 });
  }
  for (const t of parsed.data.templates) {
    await db.productTemplate.upsert({ where: { product_name: { product: auth.product, name: t.name } }, update: { spec: t }, create: { product: auth.product, name: t.name, spec: t } });
  }
  return NextResponse.json({ registered: parsed.data.templates.map((t) => t.name) });
}
