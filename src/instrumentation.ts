/** Boot do servidor (só runtime Node): validação do ambiente + worker da fila. Lógica em lib/worker.ts para não vazar APIs de Node ao bundle Edge. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootNotify } = await import("./lib/worker");
  bootNotify();
}
