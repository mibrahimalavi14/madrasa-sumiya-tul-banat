import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "./prisma";

const getCurrentSessionCached = unstable_cache(
  async () => prisma.session.findFirst({ where: { isCurrent: true } }),
  ["current-session"],
  { tags: ["current-session"], revalidate: 60 }
);

export const getCurrentSession = cache(async () => {
  return getCurrentSessionCached();
});

export async function requireCurrentSession() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}
