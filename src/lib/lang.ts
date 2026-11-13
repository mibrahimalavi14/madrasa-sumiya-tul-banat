import { cookies } from "next/headers";
import { cache } from "react";
import type { Lang } from "./i18n";

export const getLang = cache(async (): Promise<Lang> => {
  const c = await cookies();
  const v = c.get("msb_lang")?.value;
  return v === "ur" ? "ur" : "en";
});
