import { processQueue } from "./queue";
import { retryCallbacks } from "./callbacks";

/** Valida o ambiente e sobe o worker da fila no processo (chamado por instrumentation.ts só no runtime Node). */
export function bootNotify() {
  const missing = ["DATABASE_URL", "APP_URL"].filter((k) => !process.env[k]);
  const produtos = Object.keys(process.env).filter((k) => k.startsWith("NOTIFY_SECRET_"));
  if (missing.length || produtos.length === 0) {
    console.error(`[notify] Variáveis obrigatórias ausentes: ${[...missing, ...(produtos.length ? [] : ["NOTIFY_SECRET_<PRODUTO> (ao menos um)"])].join(", ")}`);
    process.exit(1);
  }
  console.log(`[notify] produtos cadastrados: ${produtos.map((k) => k.replace("NOTIFY_SECRET_", "").toLowerCase()).join(", ")} · provedor: ${process.env.WHATSAPP_PROVIDER ?? "console"}`);
  if ((process.env.NOTIFY_WORKER_INPROCESS ?? "true") !== "true") return;
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      await processQueue();
      await retryCallbacks();
    } catch (e) {
      console.error("[notify] worker:", e);
    } finally {
      rodando = false;
    }
  }, 5_000).unref();
  console.log("[notify] worker da fila ativo (5 s)");
}
