import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import prisma from "./prisma";

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isSessionExpiredByDate(session: { status: string; endDate?: Date | null }) {
  return session.status === "ACTIVE" && !!session.endDate && Date.now() > endOfDay(new Date(session.endDate)).getTime();
}

export async function autoExpireSessionsIfNeeded(options?: { revalidate?: boolean }) {
  const now = new Date();
  // Expire ACTIVE sessions whose end date has passed
  const active = await prisma.session.findMany({ where: { status: "ACTIVE", endDate: { not: null } }, select: { id: true, endDate: true, isCurrent: true } });
  const toExpire = active.filter(s => s.endDate && now.getTime() > endOfDay(new Date(s.endDate)).getTime());
  if (!toExpire.length) return 0;
  await prisma.session.updateMany({ where: { id: { in: toExpire.map(s => s.id) } }, data: { status: "EXPIRED", isCurrent: false } });
  if (options?.revalidate) revalidateTag("current-session", { expire: 0 });
  return toExpire.length;
}

const getCurrentSessionCached = unstable_cache(
  async () => prisma.session.findFirst({ where: { isCurrent: true } }),
  ["current-session"],
  { tags: ["current-session"], revalidate: 30 }
);

export const getCurrentSession = cache(async () => {
  const s = await getCurrentSessionCached();
  if (s && isSessionExpiredByDate(s)) {
    await prisma.session.update({ where: { id: s.id }, data: { status: "EXPIRED", isCurrent: false } }).catch(() => {});
    return { ...s, status: "EXPIRED", isCurrent: false } as any;
  }
  return s;
});

export async function requireCurrentSession() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}
