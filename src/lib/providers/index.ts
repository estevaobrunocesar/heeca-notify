import type { WhatsappProvider } from "../provider";
import { ConsoleProvider } from "./console";
import { MetaCloudProvider } from "./meta";
import { TwilioProvider } from "./twilio";

let cached: WhatsappProvider | null = null;
export function getProvider(): WhatsappProvider {
  if (cached) return cached;
  const name = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  cached = name === "meta" ? new MetaCloudProvider() : name === "twilio" ? new TwilioProvider() : new ConsoleProvider();
  return cached;
}
