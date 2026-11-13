import { cache } from "react";
import prisma from "./prisma";

export const getCurrentSession = cache(async () => {
  return prisma.session.findFirst({ where: { isCurrent: true } });
});

export async function requireCurrentSession() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}
