import { cookies, headers } from "next/headers";
import { resolveLang, type Lang } from "./i18n";

export async function getLang(clientLang?: string | null): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLang(c.get("faro_lang")?.value, h.get("accept-language"), clientLang);
}
