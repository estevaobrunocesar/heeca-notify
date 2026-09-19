import type { WhatsappProvider } from "../provider";
import { ConsoleProvider } from "./console";
import { MetaCloudProvider } from "./meta";

let cached: WhatsappProvider | null = null;
export function getProvider(): WhatsappProvider {
  if (cached) return cached;
  cached = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase() === "meta" ? new MetaCloudProvider() : new ConsoleProvider();
  return cached;
}
