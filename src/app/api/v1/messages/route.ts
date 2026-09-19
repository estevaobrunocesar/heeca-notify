import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";
import { enqueue, EnqueueError, enqueueSchema } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Produto → Notify: "entregue esta mensagem". Responde na hora com o id; o envio é assíncrono (worker). */
export async function POST(req: Request) {
  const raw = await req.text();
  const auth = verifyRequest(raw, req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = enqueueSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "corpo inválido", path: parsed.error.issues[0]?.path }, { status: 400 });
  try {
    const m = await enqueue(auth.product, parsed.data);
    return NextResponse.json({ id: m.id, status: m.status, ...(m.error ? { reason: m.error } : {}) }, { status: 202 });
  } catch (e) {
    if (e instanceof EnqueueError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
